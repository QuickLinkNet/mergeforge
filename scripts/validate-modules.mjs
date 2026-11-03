import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateModuleManifest } from "../packages/domain/src/modules.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulesDirectory = path.join(root, "modules");
const iconMaxBytes = 8 * 1024;
const coreBuildingIds = ["lumber-camp", "quarry", "survey-tent", "workshop", "pathfinder"];
// Kept equal to WORLD_PULSE_MS. Importing the domain entry point would require
// Node to strip TypeScript in pnpm's workspace symlink, which Node rejects.
const worldPulseMs = 10 * 60 * 1_000;

async function main() {
  const errors = [];
  let entries;

  try {
    entries = await readdir(modulesDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log("No modules directory present; nothing to validate.");
      return;
    }
    throw error;
  }

  const takenIds = [...coreBuildingIds];
  for (const entry of entries.sort((first, second) => first.name.localeCompare(second.name))) {
    if (!entry.isDirectory()) {
      errors.push(`modules/${entry.name}: module entries must be directories`);
      continue;
    }

    await validateModuleFolder(entry.name, takenIds, errors);
  }

  if (errors.length > 0) {
    console.error("Module validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${entries.length} module director${entries.length === 1 ? "y" : "ies"}.`);
}

async function validateModuleFolder(folder, takenIds, errors) {
  const relativeFolder = `modules/${folder}`;
  const folderPath = path.join(modulesDirectory, folder);
  const manifestPath = path.join(folderPath, "module.json");
  let manifest;

  try {
    const contents = await readFile(manifestPath, "utf8");
    manifest = JSON.parse(contents);
  } catch (error) {
    if (error?.code === "ENOENT") {
      errors.push(`${relativeFolder}: missing module.json`);
    } else if (error instanceof SyntaxError) {
      errors.push(`${relativeFolder}/module.json: invalid JSON (${error.message})`);
    } else {
      errors.push(`${relativeFolder}/module.json: could not be read (${error.message})`);
    }
    return;
  }

  const result = validateModuleManifest(manifest, {
    pulseMs: worldPulseMs,
    reservedIds: takenIds,
  });
  if (!result.ok) {
    errors.push(...result.errors.map((error) => `${relativeFolder}: ${error}`));
    return;
  }
  if (result.manifest.id !== folder) {
    errors.push(`${relativeFolder}: id "${result.manifest.id}" must equal the folder name`);
    return;
  }

  const iconPath = path.join(folderPath, result.manifest.building.icon);
  let icon;
  try {
    icon = await readFile(iconPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      errors.push(`${relativeFolder}: icon "${result.manifest.building.icon}" not found`);
    } else {
      errors.push(`${relativeFolder}: icon "${result.manifest.building.icon}" could not be read (${error.message})`);
    }
    return;
  }

  if (icon.byteLength > iconMaxBytes) {
    errors.push(`${relativeFolder}: icon is larger than ${iconMaxBytes} bytes`);
    return;
  }

  const iconText = icon.toString("utf8");
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(iconText) || /<script|\son\w+\s*=/i.test(iconText)) {
    errors.push(`${relativeFolder}: icon must be a plain svg without scripts`);
    return;
  }

  takenIds.push(result.manifest.id);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
