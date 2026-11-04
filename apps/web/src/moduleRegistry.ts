import {
  WORLD_PULSE_MS,
  validateModuleManifest,
  type ModuleManifest,
  type ModuleRef,
} from '@mergeforge/domain';

/** Core building ids a module must not reuse. */
const CORE_BUILDING_IDS = ['lumber-camp', 'quarry', 'survey-tent', 'workshop', 'pathfinder'] as const;
export const MODULE_ICON_MAX_BYTES = 8 * 1024;

export interface LoadedModule {
  readonly manifest: ModuleManifest;
  readonly icon: string;
}

export interface ModuleLoadResult {
  readonly modules: readonly LoadedModule[];
  readonly registry: readonly ModuleRef[];
  readonly errors: readonly string[];
}

/**
 * Pure loader core: keys are paths like ".../modules/<id>/module.json" and
 * ".../modules/<id>/<icon>.svg". Invalid modules are skipped and reported,
 * never partially loaded.
 */
export function buildModuleRegistry(
  manifests: Readonly<Record<string, unknown>>,
  icons: Readonly<Record<string, string>>,
): ModuleLoadResult {
  const modules: LoadedModule[] = [];
  const errors: string[] = [];
  const taken: string[] = [...CORE_BUILDING_IDS];

  for (const path of Object.keys(manifests).sort()) {
    const folder = /\/modules\/([^/]+)\/module\.json$/.exec(path)?.[1];
    if (folder === undefined) {
      errors.push(`${path}: not a module manifest path`);
      continue;
    }
    const result = validateModuleManifest(manifests[path], { pulseMs: WORLD_PULSE_MS, reservedIds: taken });
    if (!result.ok) {
      errors.push(...result.errors.map((error) => `${folder}: ${error}`));
      continue;
    }
    const { manifest } = result;
    if (manifest.id !== folder) {
      errors.push(`${folder}: id "${manifest.id}" must equal the folder name`);
      continue;
    }
    const iconPath = path.replace(/module\.json$/, manifest.building.icon);
    const icon = icons[iconPath];
    if (icon === undefined) {
      errors.push(`${folder}: icon "${manifest.building.icon}" not found`);
      continue;
    }
    if (new TextEncoder().encode(icon).length > MODULE_ICON_MAX_BYTES) {
      errors.push(`${folder}: icon is larger than ${MODULE_ICON_MAX_BYTES} bytes`);
      continue;
    }
    if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(icon) || /<script|\son\w+\s*=/i.test(icon)) {
      errors.push(`${folder}: icon must be a plain svg without scripts`);
      continue;
    }
    taken.push(manifest.id);
    modules.push({ manifest, icon });
  }

  return {
    modules,
    registry: modules.map(({ manifest }) => ({ id: manifest.id, version: manifest.version })),
    errors,
  };
}

const manifestFiles = import.meta.glob('../../../modules/*/module.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;
const iconFiles = import.meta.glob('../../../modules/*/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const loaded = buildModuleRegistry(manifestFiles, iconFiles);

/** Modules this build provides; saves needing others are blocked, not reset. */
export const MODULE_REGISTRY: readonly ModuleRef[] = loaded.registry;
export const LOADED_MODULES: readonly LoadedModule[] = loaded.modules;
export const MODULE_LOAD_ERRORS: readonly string[] = loaded.errors;
