import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const task = process.argv[2];

const projects = {
  domain: path.join(root, "packages", "domain"),
  worldgen: path.join(root, "packages", "worldgen"),
  renderer: path.join(root, "packages", "renderer-pixi"),
  web: path.join(root, "apps", "web"),
};

const tools = {
  tsc: path.join(root, "node_modules", "typescript", "bin", "tsc"),
  vite: path.join(root, "node_modules", "vite", "bin", "vite.js"),
  vitest: path.join(root, "node_modules", "vitest", "vitest.mjs"),
};

function runNode(script, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command stopped by ${signal}.`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

async function typecheck() {
  await runNode(tools.tsc, ["-p", "tsconfig.json"], projects.domain);
  await runNode(tools.tsc, ["-p", "tsconfig.json"], projects.worldgen);
  await runNode(tools.tsc, ["-p", "tsconfig.json", "--noEmit"], projects.renderer);
  await runNode(tools.tsc, ["-p", "tsconfig.app.json", "--noEmit", "--pretty", "false"], projects.web);
  await runNode(tools.tsc, ["-p", "tsconfig.node.json", "--noEmit", "--pretty", "false"], projects.web);
}

async function test() {
  for (const project of Object.values(projects)) {
    await runNode(tools.vitest, ["run"], project);
  }
}

async function build() {
  await typecheck();
  await runNode(tools.vite, ["build"], projects.web);
}

async function main() {
  switch (task) {
    case "dev":
      await runNode(tools.vite, ["--host", "127.0.0.1"], projects.web);
      break;
    case "typecheck":
      await typecheck();
      break;
    case "test":
      await test();
      break;
    case "build":
      await build();
      break;
    case "check":
      await typecheck();
      await test();
      await runNode(tools.vite, ["build"], projects.web);
      break;
    default:
      throw new Error(`Unknown workspace task: ${task ?? "<missing>"}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
