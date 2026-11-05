/**
 * The build catalog: one readable list of everything a player can build, train
 * or unlock, with cost, duration and prerequisites.
 *
 * It feeds the in-game build menu and the generated tech-tree overview
 * (docs/TECH_TREE.svg). New content is added here (core) or comes from a module
 * manifest (`moduleCatalogEntry`), so both views stay in step automatically.
 *
 * The numbers are read from the same constants the game rules use; the tests
 * pin this, so the overview can never promise something the game does not do.
 */

import {
  LUMBER_CAMP_BUILD_MS,
  LUMBER_CAMP_STONE_COST,
  LUMBER_CAMP_WOOD_COST,
  LUMBER_CAMP_WOOD_PER_PULSE,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  PATHFINDER_STONE_COST,
  PATHFINDER_TRAINING_MS,
  PATHFINDER_WOOD_COST,
  QUARRY_BUILD_MS,
  QUARRY_STONE_COST,
  QUARRY_STONE_PER_PULSE,
  QUARRY_WOOD_COST,
  RELAY_REPAIR_MS,
  RELAY_REPAIR_STONE_COST,
  RELAY_REPAIR_WOOD_COST,
  ROAD_WOOD_COST,
  SURVEY_TENT_BUILD_MS,
  SURVEY_TENT_STONE_COST,
  SURVEY_TENT_WOOD_COST,
  WORKSHOP_BUILD_MS,
  WORKSHOP_STONE_COST,
  WORKSHOP_WOOD_COST,
  WORLD_PULSE_MS,
} from "./index";
import type { ModuleManifest } from "./modules";

export type CatalogCategory =
  | "infrastructure"
  | "production"
  | "unit"
  | "research"
  | "network"
  | "module";

/** Where a catalog entry is started from. */
export type CatalogPlacement =
  /** a field the player picks on the map (forest, stone site, ...) */
  | "field"
  /** the village */
  | "village"
  /** the relay */
  | "relay"
  /** no spot needed (a mini-game or a scan) */
  | "none";

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly category: CatalogCategory;
  readonly placement: CatalogPlacement;
  readonly cost: { readonly wood: number; readonly stone: number };
  /** 0 = instant. A whole number of world pulses for everything that is built. */
  readonly buildMs: number;
  /** True while the entry occupies the single build slot. */
  readonly usesBuildSlot: boolean;
  /** Ids of the entries that must exist (or be finished) first. */
  readonly requires: readonly string[];
  /** Plain-language condition for the player (the "why can't I build this yet"). */
  readonly condition: string;
  /** Plain-language result. */
  readonly effect: string;
  /** Who contributed it: the core game or a module id. */
  readonly source: "core" | string;
  /** The build menu hides the entry until this prologue chapter is finished (the tech tree always shows it). */
  readonly revealAfterChapter?: 3 | 4 | 5 | 6 | 7;
}

const TERRAIN_NAMES: Readonly<Record<string, string>> = {
  forest: "Wald",
  meadow: "Wiese",
  hills: "Hügel",
  water: "Wasser",
};

/** Player-facing name of a terrain type. */
export function terrainName(terrain: string): string {
  return TERRAIN_NAMES[terrain] ?? terrain;
}

const FREE = { wood: 0, stone: 0 } as const;

/** The core catalog in tech-tree order (prerequisites before dependants). */
export function coreCatalog(): readonly CatalogEntry[] {
  return [
    {
      id: "road",
      name: "Straße",
      category: "infrastructure",
      placement: "field",
      cost: { wood: ROAD_WOOD_COST, stone: 0 },
      buildMs: 0,
      usesBuildSlot: false,
      requires: [],
      condition: "Sichtbares Feld neben dem Straßennetz",
      effect: "Deckt angrenzende Felder auf, verbindet Standorte",
      source: "core",
    },
    {
      id: "lumber-camp",
      name: "Holzfällerlager",
      category: "production",
      placement: "field",
      cost: { wood: LUMBER_CAMP_WOOD_COST, stone: LUMBER_CAMP_STONE_COST },
      buildMs: LUMBER_CAMP_BUILD_MS,
      usesBuildSlot: true,
      requires: ["road"],
      condition: "Wald-Feld mit Straße",
      effect: `+${LUMBER_CAMP_WOOD_PER_PULSE} Holz pro Takt`,
      source: "core",
    },
    {
      id: "quarry",
      name: "Steinbruch",
      category: "production",
      placement: "field",
      cost: { wood: QUARRY_WOOD_COST, stone: QUARRY_STONE_COST },
      buildMs: QUARRY_BUILD_MS,
      usesBuildSlot: true,
      requires: ["road"],
      condition: "Steinvorkommen mit Straße",
      effect: `+${QUARRY_STONE_PER_PULSE} Stein pro Takt`,
      source: "core",
    },
    {
      id: "pathfinder",
      name: "Wegfinder",
      category: "unit",
      placement: "village",
      cost: { wood: PATHFINDER_WOOD_COST, stone: PATHFINDER_STONE_COST },
      buildMs: PATHFINDER_TRAINING_MS,
      usesBuildSlot: true,
      requires: [],
      condition: "Nur ein Wegfinder; im Dorf ausbilden",
      effect: `Erkundet Nebelfelder, ${PATHFINDER_BASE_MAX_CHARGES} Ladungen (+1 pro Takt)`,
      source: "core",
    },
    {
      id: "survey-tent",
      name: "Vermesserzelt",
      category: "research",
      placement: "village",
      cost: { wood: SURVEY_TENT_WOOD_COST, stone: SURVEY_TENT_STONE_COST },
      buildMs: SURVEY_TENT_BUILD_MS,
      usesBuildSlot: true,
      requires: ["pathfinder"],
      condition: "Wegfinder ist ausgebildet",
      effect: `Ladungsspeicher ${PATHFINDER_BASE_MAX_CHARGES} → ${PATHFINDER_EXPANDED_MAX_CHARGES}`,
      source: "core",
    },
    {
      id: "signalwerk",
      name: "Signalwerk",
      category: "research",
      placement: "relay",
      cost: FREE,
      buildMs: 0,
      usesBuildSlot: false,
      requires: ["road"],
      condition: "Relais entdeckt, am Relais lösen",
      effect: "Minispiel 5×5; birgt den Resonanzkern",
      source: "core",
      revealAfterChapter: 4,
    },
    {
      id: "workshop",
      name: "Relaiswerkstatt",
      category: "research",
      placement: "village",
      cost: { wood: WORKSHOP_WOOD_COST, stone: WORKSHOP_STONE_COST },
      buildMs: WORKSHOP_BUILD_MS,
      usesBuildSlot: true,
      requires: ["signalwerk"],
      condition: "Signalwerk gelöst",
      effect: "Schaltet die Relaisreparatur frei",
      source: "core",
      revealAfterChapter: 4,
    },
    {
      id: "relay-repair",
      name: "Relais reparieren",
      category: "network",
      placement: "village",
      cost: { wood: RELAY_REPAIR_WOOD_COST, stone: RELAY_REPAIR_STONE_COST },
      buildMs: RELAY_REPAIR_MS,
      usesBuildSlot: true,
      requires: ["workshop", "signalwerk"],
      condition: "Werkstatt fertig, Resonanzkern vorhanden",
      effect: "Relais wird aktiv",
      source: "core",
      revealAfterChapter: 4,
    },
    {
      id: "signal-scan",
      name: "Fernsignal scannen",
      category: "network",
      placement: "village",
      cost: FREE,
      buildMs: 0,
      usesBuildSlot: false,
      requires: ["relay-repair"],
      condition: "Relais aktiv",
      effect: "Signalnetz aktiv, Funkkontakte sichtbar",
      source: "core",
      revealAfterChapter: 4,
    },
    {
      id: "market",
      name: "Handelsposten",
      category: "network",
      placement: "none",
      cost: FREE,
      buildMs: 0,
      usesBuildSlot: false,
      requires: ["signal-scan"],
      condition: "Signalnetz aktiv, Online-Konto",
      effect: "Tauschangebote mit den Funkkontakten",
      source: "core",
      revealAfterChapter: 4,
    },
  ];
}

/** The catalog entry of a data module (a producing building on a field). */
export function moduleCatalogEntry(manifest: ModuleManifest): CatalogEntry {
  const { building } = manifest;
  const terrain = building.placement.terrain.map(terrainName).join(" / ");
  const resourceName = building.production.resource === "wood" ? "Holz" : "Stein";
  return {
    id: `module:${manifest.id}`,
    name: manifest.name,
    category: "module",
    placement: "field",
    cost: { wood: building.cost.wood, stone: building.cost.stone },
    buildMs: building.buildTimeMs,
    usesBuildSlot: true,
    requires: building.placement.requiresRoadConnection ? ["road"] : [],
    condition: `Feld: ${terrain}${building.placement.requiresRoadConnection ? " mit Straße" : ""}`,
    effect: `+${building.production.amountPerPulse} ${resourceName} pro Takt`,
    source: manifest.id,
  };
}

/** Core and module entries in one list. */
export function buildCatalog(modules: readonly ModuleManifest[]): readonly CatalogEntry[] {
  return [...coreCatalog(), ...modules.map(moduleCatalogEntry)];
}

/** Build time as players read it: "Sofort", "10 Min", "1 Std 30 Min". */
export function formatBuildTime(buildMs: number): string {
  if (buildMs <= 0) return "Sofort";
  const minutes = Math.round(buildMs / 60_000);
  if (minutes < 60) return `${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} Std` : `${hours} Std ${rest} Min`;
}

/** Number of world pulses a build takes ("1 Takt"), 0 for instant entries. */
export function buildPulses(buildMs: number): number {
  return Math.round(buildMs / WORLD_PULSE_MS);
}

/** Depth of every entry in the tech tree (0 = available from the start). */
export function catalogDepths(entries: readonly CatalogEntry[]): ReadonlyMap<string, number> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const depths = new Map<string, number>();
  const depthOf = (id: string, trail: readonly string[]): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    if (trail.includes(id)) throw new RangeError(`Catalog prerequisites form a cycle at "${id}".`);
    const entry = byId.get(id);
    if (entry === undefined) throw new RangeError(`Catalog entry "${id}" is required but missing.`);
    const depth =
      entry.requires.length === 0
        ? 0
        : 1 + Math.max(...entry.requires.map((required) => depthOf(required, [...trail, id])));
    depths.set(id, depth);
    return depth;
  };
  for (const entry of entries) depthOf(entry.id, []);
  return depths;
}
