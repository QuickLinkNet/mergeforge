/**
 * Module manifest validation (draft: docs/MERGEFORGE_Module_Draft_Harzsammler.md).
 *
 * A manifest is plain data. This validator is pure: it never reads files,
 * never executes anything and never mutates its input. Icon files and module
 * folders are checked by the loader, not here.
 */

export const MODULE_MANIFEST_VERSION = 1 as const;
export const MODULE_MAX_PRODUCTION_PER_PULSE = 5;
export const MODULE_MAX_COST = 50;
export const MODULE_MAX_BUILD_PULSES = 24;

export type ModuleTerrain = "meadow" | "forest" | "hills" | "water";
export type ModuleResource = "wood" | "stone";

export interface ModuleManifest {
  readonly manifestVersion: typeof MODULE_MANIFEST_VERSION;
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly building: {
    readonly placement: {
      readonly terrain: readonly ModuleTerrain[];
      readonly requiresRoadConnection: boolean;
    };
    readonly cost: { readonly wood: number; readonly stone: number };
    readonly buildTimeMs: number;
    readonly icon: string;
    readonly production: {
      readonly resource: ModuleResource;
      readonly amountPerPulse: number;
    };
  };
}

export interface ModuleValidationContext {
  /** Length of one world pulse; build time must be a whole number of pulses. */
  readonly pulseMs: number;
  /** Ids already taken by core buildings or other modules. */
  readonly reservedIds: readonly string[];
}

export type ModuleValidationResult =
  | { readonly ok: true; readonly manifest: ModuleManifest }
  | { readonly ok: false; readonly errors: readonly string[] };

const TERRAINS: readonly ModuleTerrain[] = ["meadow", "forest", "hills", "water"];
const RESOURCES: readonly ModuleResource[] = ["wood", "stone"];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const ICON_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}\.svg$/;

export function validateModuleManifest(
  input: unknown,
  context: ModuleValidationContext,
): ModuleValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) return { ok: false, errors: ["manifest must be an object"] };
  rejectUnknownKeys(input, ["manifestVersion", "id", "version", "name", "building"], "manifest", errors);

  if (input.manifestVersion !== MODULE_MANIFEST_VERSION) errors.push("manifestVersion is unknown");
  const id = input.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    errors.push("id must match [a-z0-9-] and be 1-32 characters");
  } else if (context.reservedIds.includes(id)) {
    errors.push("id is already taken");
  }
  if (typeof input.version !== "string" || !VERSION_PATTERN.test(input.version)) {
    errors.push("version must look like 1.0.0");
  }
  if (typeof input.name !== "string" || input.name.trim().length === 0 || input.name.length > 40) {
    errors.push("name must be 1-40 characters");
  }

  const building = input.building;
  if (!isRecord(building)) {
    errors.push("building must be an object");
  } else {
    rejectUnknownKeys(building, ["placement", "cost", "buildTimeMs", "icon", "production"], "building", errors);
    validatePlacement(building.placement, errors);
    validateCost(building.cost, errors);
    validateBuildTime(building.buildTimeMs, context.pulseMs, errors);
    if (typeof building.icon !== "string" || !ICON_PATTERN.test(building.icon)) {
      errors.push("icon must be a plain .svg file name in the module folder");
    }
    validateProduction(building.production, errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: input as unknown as ModuleManifest };
}

function validatePlacement(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("building.placement must be an object");
    return;
  }
  rejectUnknownKeys(value, ["terrain", "requiresRoadConnection"], "building.placement", errors);
  const terrain = value.terrain;
  if (
    !Array.isArray(terrain) ||
    terrain.length === 0 ||
    new Set(terrain).size !== terrain.length ||
    terrain.some((entry) => !TERRAINS.includes(entry as ModuleTerrain))
  ) {
    errors.push("placement.terrain must be a non-empty, duplicate-free list of known terrains");
  }
  if (typeof value.requiresRoadConnection !== "boolean") {
    errors.push("placement.requiresRoadConnection must be a boolean");
  }
}

function validateCost(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("building.cost must be an object");
    return;
  }
  rejectUnknownKeys(value, ["wood", "stone"], "building.cost", errors);
  for (const resource of RESOURCES) {
    const amount = value[resource];
    if (!Number.isInteger(amount) || (amount as number) < 0 || (amount as number) > MODULE_MAX_COST) {
      errors.push(`cost.${resource} must be a whole number from 0 to ${MODULE_MAX_COST}`);
    }
  }
}

function validateBuildTime(value: unknown, pulseMs: number, errors: string[]): void {
  if (
    !Number.isInteger(value) ||
    (value as number) < pulseMs ||
    (value as number) > pulseMs * MODULE_MAX_BUILD_PULSES ||
    (value as number) % pulseMs !== 0
  ) {
    errors.push(`buildTimeMs must be 1-${MODULE_MAX_BUILD_PULSES} whole world pulses`);
  }
}

function validateProduction(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("building.production must be an object");
    return;
  }
  rejectUnknownKeys(value, ["resource", "amountPerPulse"], "building.production", errors);
  if (!RESOURCES.includes(value.resource as ModuleResource)) {
    errors.push("production.resource must be a known resource");
  }
  const amount = value.amountPerPulse;
  if (!Number.isInteger(amount) || (amount as number) < 1 || (amount as number) > MODULE_MAX_PRODUCTION_PER_PULSE) {
    errors.push(`production.amountPerPulse must be a whole number from 1 to ${MODULE_MAX_PRODUCTION_PER_PULSE}`);
  }
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${label}: unknown field "${key}"`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
