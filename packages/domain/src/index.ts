import {
  createSignalwerkPuzzle,
  isSignalwerkSolved,
  rotateSignalwerkTile,
  type SignalRotation,
} from "@mergeforge/signalwerk";
import { createFarSignals, type FarSignal } from "./signals";
import type { ModuleManifest, ModuleRef } from "./modules";

export * from "./signals";
export * from "./modules";
export * from "./players";

export type Terrain = "meadow" | "forest" | "hills" | "water";

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export interface HexTile {
  readonly coord: HexCoord;
  readonly terrain: Terrain;
  readonly elevation: number;
}

export interface Village {
  readonly id: string;
  readonly name: string;
  readonly coord: HexCoord;
}

export type ResourceSiteType = "stone";

export interface ResourceSite {
  readonly id: string;
  readonly type: ResourceSiteType;
  readonly tileKey: string;
}

export interface RelaySite {
  readonly id: string;
  readonly tileKey: string;
}

export type SurfaceFindResourceType = "stone";

export interface SurfaceFind {
  readonly id: string;
  readonly resourceType: SurfaceFindResourceType;
  readonly tileKey: string;
  readonly amount: number;
}

export interface WorldSnapshot {
  readonly seed: string;
  readonly generatorVersion: string;
  readonly radius: number;
  readonly tiles: readonly HexTile[];
  readonly village: Village;
  readonly visibleTileKeys: readonly string[];
  readonly resourceSites: readonly ResourceSite[];
  readonly relaySite: RelaySite;
  readonly surfaceFinds: readonly SurfaceFind[];
}

export interface ResourceStock {
  readonly wood: number;
  readonly stone: number;
}

export type BuildingStatus = "constructing" | "active";

export interface LumberCamp {
  readonly id: string;
  readonly type: "lumber-camp";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastProductionAtMs: number;
}

export interface Quarry {
  readonly id: string;
  readonly type: "quarry";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastProductionAtMs: number;
}

export interface SurveyTent {
  readonly id: string;
  readonly type: "survey-tent";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
}

export interface Workshop {
  readonly id: string;
  readonly type: "workshop";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
}

/**
 * A building defined by a module manifest. Cost and build time are settled at
 * build start; the production rule is frozen into the building so settling
 * time never needs the manifest, and persistence checks it against the module.
 */
export interface ModuleBuilding {
  readonly id: string;
  readonly type: "module";
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastProductionAtMs: number;
  readonly production: {
    readonly resource: "wood" | "stone";
    readonly amountPerPulse: number;
  };
}

export type Building = LumberCamp | Quarry | SurveyTent | Workshop | ModuleBuilding;

export type PathfinderStatus = "training" | "active";

export interface Pathfinder {
  readonly id: string;
  readonly type: "pathfinder";
  readonly status: PathfinderStatus;
  readonly tileKey: string;
  readonly charges: number;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastChargeAtMs: number;
}

export type Unit = Pathfinder;

export type PrologueChapterId = 3 | 4 | 5 | 6 | 7;
export type PrologueEventId =
  | "relay_discovered"
  | "signalwerk_solved"
  | "relay_repaired"
  | "first_signals_received";

/** Internal capabilities a module can later require; never a currency. */
export type RelayCapability = "signal_network_active";

export interface PrologueProgress {
  readonly stoneProductionObserved: boolean;
  readonly pathfinderSurveysCompleted: number;
  readonly completedChapterIds: readonly PrologueChapterId[];
  readonly eventIds: readonly PrologueEventId[];
}

export interface SignalwerkState {
  readonly seed: string;
  readonly rotations: readonly SignalRotation[];
  readonly solved: boolean;
}

export interface Inventory {
  readonly resonanceCore: 0 | 1;
}

export type RelayState =
  | { readonly status: "dormant"; readonly coreInstalled: false }
  | {
      readonly status: "repairing" | "active";
      readonly coreInstalled: true;
      readonly startedAtMs: number;
      readonly completesAtMs: number;
      readonly capabilities: readonly RelayCapability[];
    };

/** Mutable game progress represented as an immutable, serializable value. */
export interface GameState {
  readonly schemaVersion: typeof GAME_STATE_SCHEMA_VERSION;
  readonly world: WorldSnapshot;
  readonly resources: ResourceStock;
  readonly roadTileKeys: readonly string[];
  readonly visibleTileKeys: readonly string[];
  readonly claimedSurfaceFindTileKeys: readonly string[];
  readonly buildings: readonly Building[];
  readonly units: readonly Unit[];
  readonly prologue: PrologueProgress;
  readonly signalwerk: SignalwerkState;
  readonly inventory: Inventory;
  readonly relay: RelayState;
  /** Coarse far signals; empty until chapter 7 has been completed. */
  readonly signals: readonly FarSignal[];
  /** Modules this save depends on; empty until a module building is built. */
  readonly modules: readonly ModuleRef[];
  readonly lastAdvancedAtMs: number;
}

export type BuildRoadRejection =
  | "tile-not-found"
  | "not-visible"
  | "not-traversable"
  | "village-tile"
  | "already-road"
  | "not-connected"
  | "insufficient-wood";

export type BuildRoadResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: BuildRoadRejection;
      readonly state: GameState;
    };

export type StartLumberCampRejection =
  | "tile-not-found"
  | "not-forest"
  | "road-required"
  | "already-built"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartLumberCampResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartLumberCampRejection;
      readonly state: GameState;
    };

export type StartQuarryRejection =
  | "tile-not-found"
  | "not-stone-site"
  | "road-required"
  | "already-built"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartQuarryResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartQuarryRejection;
      readonly state: GameState;
    };

export type StartPathfinderTrainingRejection =
  | "already-exists"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartPathfinderTrainingResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartPathfinderTrainingRejection;
      readonly state: GameState;
    };

export type MovePathfinderRejection =
  | "pathfinder-not-found"
  | "pathfinder-not-active"
  | "tile-not-found"
  | "not-road-network";

export type MovePathfinderResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: MovePathfinderRejection;
      readonly state: GameState;
    };

export type SurveyWithPathfinderRejection =
  | "pathfinder-not-found"
  | "pathfinder-not-active"
  | "roadhead-required"
  | "tile-not-found"
  | "not-in-survey-range"
  | "already-visible"
  | "no-charges";

export type SurveyWithPathfinderResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: SurveyWithPathfinderRejection;
      readonly state: GameState;
    };

export type StartSurveyTentRejection =
  | "already-built"
  | "pathfinder-required"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartSurveyTentResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartSurveyTentRejection;
      readonly state: GameState;
    };

export type RotateSignalwerkRuneRejection =
  | "locked"
  | "already-solved"
  | "tile-not-found";

export type RotateSignalwerkRuneResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: RotateSignalwerkRuneRejection;
      readonly state: GameState;
    };

export type StartWorkshopRejection =
  | "locked"
  | "already-built"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartWorkshopResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: StartWorkshopRejection; readonly state: GameState };

export type StartModuleBuildingRejection =
  | "tile-not-found"
  | "terrain-not-allowed"
  | "not-visible"
  | "road-required"
  | "already-built"
  | "module-version-conflict"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartModuleBuildingResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: StartModuleBuildingRejection; readonly state: GameState };

export type StartRelayRepairRejection =
  | "locked"
  | "workshop-required"
  | "already-started"
  | "build-slot-occupied"
  | "core-required"
  | "insufficient-resources";

export type StartRelayRepairResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: StartRelayRepairRejection; readonly state: GameState };

export type ScanFarSignalsRejection = "locked" | "already-scanned";

export type ScanFarSignalsResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: ScanFarSignalsRejection; readonly state: GameState };

export const GAME_STATE_SCHEMA_VERSION = 7 as const;

export const STARTING_RESOURCES: ResourceStock = {
  wood: 12,
  stone: 6,
};

export const MAX_WOOD_STORAGE = 300;
export const MAX_STONE_STORAGE = 150;
export const ROAD_WOOD_COST = 1;
export const FOREST_SURFACE_WOOD = 1;
export const STONE_SURFACE_FIND_TOTAL = 4;
export const WORLD_PULSE_MS = 10 * 60 * 1_000;
export const LUMBER_CAMP_BUILD_MS = WORLD_PULSE_MS;
export const LUMBER_CAMP_WOOD_COST = 4;
export const LUMBER_CAMP_STONE_COST = 1;
export const LUMBER_CAMP_WOOD_PER_PULSE = 2;
export const QUARRY_BUILD_MS = WORLD_PULSE_MS;
export const QUARRY_WOOD_COST = 3;
export const QUARRY_STONE_COST = 1;
export const QUARRY_STONE_PER_PULSE = 1;
export const PATHFINDER_TRAINING_MS = WORLD_PULSE_MS;
export const PATHFINDER_WOOD_COST = 2;
export const PATHFINDER_STONE_COST = 2;
export const PATHFINDER_BASE_MAX_CHARGES = 6;
export const PATHFINDER_CHARGES_PER_PULSE = 1;
export const SURVEY_TENT_BUILD_MS = WORLD_PULSE_MS;
export const SURVEY_TENT_WOOD_COST = 3;
export const SURVEY_TENT_STONE_COST = 1;
export const PATHFINDER_EXPANDED_MAX_CHARGES = 12;
export const WORKSHOP_BUILD_MS = 2 * WORLD_PULSE_MS;
export const WORKSHOP_WOOD_COST = 6;
export const WORKSHOP_STONE_COST = 4;
export const RELAY_REPAIR_MS = 3 * WORLD_PULSE_MS;
export const RELAY_REPAIR_WOOD_COST = 5;
export const RELAY_REPAIR_STONE_COST = 6;

/** A stable, serialization-friendly key for an axial coordinate. */
export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

/**
 * Returns axial neighbors in a canonical clockwise order, beginning east.
 * The order is part of the deterministic world-generation contract.
 */
export function axialNeighbors(coord: HexCoord): readonly HexCoord[] {
  return [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q - 1, r: coord.r + 1 },
    { q: coord.q, r: coord.r + 1 },
  ];
}

/** Creates player progress without modifying the generated world snapshot. */
export function createInitialGameState(world: WorldSnapshot, nowMs = 0): GameState {
  assertTime(nowMs);
  const signalwerkSeed = `${world.seed}:signalwerk:${world.relaySite.tileKey}`;
  const signalwerkPuzzle = createSignalwerkPuzzle(signalwerkSeed);

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    world,
    resources: { ...STARTING_RESOURCES },
    roadTileKeys: [],
    visibleTileKeys: [...world.visibleTileKeys],
    claimedSurfaceFindTileKeys: [],
    buildings: [],
    units: [],
    prologue: {
      stoneProductionObserved: false,
      pathfinderSurveysCompleted: 0,
      completedChapterIds: [],
      eventIds: [],
    },
    signalwerk: {
      seed: signalwerkSeed,
      rotations: [...signalwerkPuzzle.initialRotations],
      solved: false,
    },
    inventory: { resonanceCore: 0 },
    relay: { status: "dormant", coreInstalled: false },
    signals: [],
    modules: [],
    lastAdvancedAtMs: nowMs,
  };
}

export function hasCompletedChapter(
  state: GameState,
  chapterId: PrologueChapterId,
): boolean {
  return state.prologue.completedChapterIds.includes(chapterId);
}

export function hasRelayCapability(
  state: GameState,
  capability: RelayCapability,
): boolean {
  return state.relay.status !== "dormant" && state.relay.capabilities.includes(capability);
}

export function hasPrologueEvent(
  state: GameState,
  eventId: PrologueEventId,
): boolean {
  return state.prologue.eventIds.includes(eventId);
}

/** Rotates one Signalwerk rune and awards the unique core on first solution. */
export function rotateSignalwerkRune(
  state: GameState,
  index: number,
): RotateSignalwerkRuneResult {
  if (
    !hasCompletedChapter(state, 5) ||
    !hasPrologueEvent(state, "relay_discovered")
  ) {
    return rotateSignalwerkRuneRejected(state, "locked");
  }
  if (state.signalwerk.solved) {
    return rotateSignalwerkRuneRejected(state, "already-solved");
  }
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= state.signalwerk.rotations.length
  ) {
    return rotateSignalwerkRuneRejected(state, "tile-not-found");
  }

  const puzzle = createSignalwerkPuzzle(state.signalwerk.seed);
  const rotations = rotateSignalwerkTile(state.signalwerk.rotations, index);
  const solved = isSignalwerkSolved(puzzle, rotations);
  const eventIds =
    solved && !state.prologue.eventIds.includes("signalwerk_solved")
      ? [...state.prologue.eventIds, "signalwerk_solved" as const]
      : state.prologue.eventIds;

  return {
    ok: true,
    state: {
      ...state,
      signalwerk: {
        ...state.signalwerk,
        rotations,
        solved,
      },
      inventory: solved ? { resonanceCore: 1 } : state.inventory,
      prologue:
        eventIds === state.prologue.eventIds
          ? state.prologue
          : { ...state.prologue, eventIds },
    },
  };
}

/** Starts the village workshop after the Signalwerk has yielded its core. */
export function startWorkshop(
  state: GameState,
  nowMs: number,
): StartWorkshopResult {
  const settledState = advanceTime(state, nowMs);
  if (!settledState.signalwerk.solved || !hasPrologueEvent(settledState, "signalwerk_solved")) {
    return workshopRejected(settledState, "locked");
  }
  if (settledState.buildings.some((building) => building.type === "workshop")) {
    return workshopRejected(settledState, "already-built");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return workshopRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < WORKSHOP_WOOD_COST ||
    settledState.resources.stone < WORKSHOP_STONE_COST
  ) {
    return workshopRejected(settledState, "insufficient-resources");
  }
  const tileKey = hexKey(settledState.world.village.coord);
  const completesAtMs = nowMs + WORKSHOP_BUILD_MS;
  assertTime(completesAtMs);
  const workshop: Workshop = {
    id: `workshop:${tileKey}`,
    type: "workshop",
    tileKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
  };
  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - WORKSHOP_WOOD_COST,
        stone: settledState.resources.stone - WORKSHOP_STONE_COST,
      },
      buildings: [...settledState.buildings, workshop],
    },
  };
}

/** Installs the unique core and starts the one-time relay repair. */
export function startRelayRepair(
  state: GameState,
  nowMs: number,
): StartRelayRepairResult {
  const settledState = advanceTime(state, nowMs);
  if (!settledState.signalwerk.solved || !hasCompletedChapter(settledState, 5)) {
    return relayRepairRejected(settledState, "locked");
  }
  const workshop = settledState.buildings.find((building) => building.type === "workshop");
  if (workshop?.status !== "active") {
    return relayRepairRejected(settledState, "workshop-required");
  }
  if (settledState.relay.status !== "dormant") {
    return relayRepairRejected(settledState, "already-started");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return relayRepairRejected(settledState, "build-slot-occupied");
  }
  if (settledState.inventory.resonanceCore !== 1) {
    return relayRepairRejected(settledState, "core-required");
  }
  if (
    settledState.resources.wood < RELAY_REPAIR_WOOD_COST ||
    settledState.resources.stone < RELAY_REPAIR_STONE_COST
  ) {
    return relayRepairRejected(settledState, "insufficient-resources");
  }
  const completesAtMs = nowMs + RELAY_REPAIR_MS;
  assertTime(completesAtMs);
  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - RELAY_REPAIR_WOOD_COST,
        stone: settledState.resources.stone - RELAY_REPAIR_STONE_COST,
      },
      inventory: { resonanceCore: 0 },
      relay: {
        status: "repairing",
        coreInstalled: true,
        startedAtMs: nowMs,
        completesAtMs,
        capabilities: [],
      },
    },
  };
}

/**
 * Chapter 7: the player scans for far signals once the relay is active. Costs
 * nothing; the active relay gains the capability and the two deterministic,
 * coarse signals are revealed, all in one atomic step.
 */
export function scanFarSignals(state: GameState, nowMs: number): ScanFarSignalsResult {
  const settledState = advanceTime(state, nowMs);
  if (settledState.prologue.completedChapterIds.includes(7)) {
    return { ok: false, reason: "already-scanned", state: settledState };
  }
  if (
    !hasCompletedChapter(settledState, 6) ||
    settledState.relay.status !== "active"
  ) {
    return { ok: false, reason: "locked", state: settledState };
  }
  return {
    ok: true,
    state: {
      ...settledState,
      relay: {
        ...settledState.relay,
        capabilities: [...settledState.relay.capabilities, "signal_network_active"],
      },
      signals: createFarSignals(
        settledState.world.seed,
        settledState.world.generatorVersion,
      ),
      prologue: {
        ...settledState.prologue,
        completedChapterIds: [...settledState.prologue.completedChapterIds, 7],
        eventIds: [...settledState.prologue.eventIds, "first_signals_received"],
      },
    },
  };
}

/**
 * Attempts one road build as an atomic, immutable state transition.
 * Rejected commands return the original state unchanged.
 */
export function buildRoad(state: GameState, target: HexCoord): BuildRoadResult {
  const targetKey = hexKey(target);
  const tilesByKey = new Map(
    state.world.tiles.map((tile) => [hexKey(tile.coord), tile] as const),
  );
  const targetTile = tilesByKey.get(targetKey);

  if (targetTile === undefined) return rejected(state, "tile-not-found");
  if (!state.visibleTileKeys.includes(targetKey)) return rejected(state, "not-visible");
  if (targetTile.terrain === "water") return rejected(state, "not-traversable");
  if (targetKey === hexKey(state.world.village.coord)) return rejected(state, "village-tile");
  if (state.roadTileKeys.includes(targetKey)) return rejected(state, "already-road");
  if (!isConnectedToRoadNetwork(state, target)) return rejected(state, "not-connected");
  if (state.resources.wood < ROAD_WOOD_COST) {
    return rejected(state, "insufficient-wood");
  }

  const visibleKeys = new Set(state.visibleTileKeys);
  visibleKeys.add(targetKey);

  for (const neighbor of axialNeighbors(target)) {
    const neighborKey = hexKey(neighbor);
    if (tilesByKey.has(neighborKey)) visibleKeys.add(neighborKey);
  }

  const surfaceFindsByTileKey = new Map(
    state.world.surfaceFinds.map((find) => [find.tileKey, find] as const),
  );
  const newlyVisibleForestKeys = [...visibleKeys].filter((tileKey) => {
    if (state.visibleTileKeys.includes(tileKey)) return false;
    if (state.claimedSurfaceFindTileKeys.includes(tileKey)) return false;
    if (surfaceFindsByTileKey.has(tileKey)) return false;
    return tilesByKey.get(tileKey)?.terrain === "forest";
  });
  const newlyVisibleStoneFinds = state.world.surfaceFinds.filter((find) => {
    if (find.resourceType !== "stone") return false;
    if (!visibleKeys.has(find.tileKey)) return false;
    if (state.visibleTileKeys.includes(find.tileKey)) return false;
    return !state.claimedSurfaceFindTileKeys.includes(find.tileKey);
  });
  const foundStone = newlyVisibleStoneFinds.reduce(
    (total, find) => total + find.amount,
    0,
  );

  const nextState: GameState = {
    ...state,
    resources: {
      ...state.resources,
      wood: Math.min(
        MAX_WOOD_STORAGE,
        state.resources.wood -
          ROAD_WOOD_COST +
          newlyVisibleForestKeys.length * FOREST_SURFACE_WOOD,
      ),
      stone: Math.min(MAX_STONE_STORAGE, state.resources.stone + foundStone),
    },
    roadTileKeys: [...state.roadTileKeys, targetKey],
    visibleTileKeys: [...visibleKeys],
    claimedSurfaceFindTileKeys: [
      ...state.claimedSurfaceFindTileKeys,
      ...newlyVisibleForestKeys,
      ...newlyVisibleStoneFinds.map(({ tileKey }) => tileKey),
    ],
  };
  const relayDiscovered =
    !state.visibleTileKeys.includes(state.world.relaySite.tileKey) &&
    visibleKeys.has(state.world.relaySite.tileKey);

  return {
    ok: true,
    state: reconcilePrologue(nextState, { relayDiscovered }),
  };
}

/**
 * Starts a lumber camp after first settling elapsed construction and production
 * at the explicit command time. The caller should keep the returned state even
 * for a rejected command because time may have advanced.
 */
export function startLumberCamp(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): StartLumberCampResult {
  const settledState = advanceTime(state, nowMs);
  const targetKey = hexKey(target);
  const targetTile = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === targetKey,
  );

  if (targetTile === undefined) {
    return lumberCampRejected(settledState, "tile-not-found");
  }
  if (targetTile.terrain !== "forest") {
    return lumberCampRejected(settledState, "not-forest");
  }
  if (!settledState.roadTileKeys.includes(targetKey)) {
    return lumberCampRejected(settledState, "road-required");
  }
  if (settledState.buildings.some((building) => building.tileKey === targetKey)) {
    return lumberCampRejected(settledState, "already-built");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return lumberCampRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < LUMBER_CAMP_WOOD_COST ||
    settledState.resources.stone < LUMBER_CAMP_STONE_COST
  ) {
    return lumberCampRejected(settledState, "insufficient-resources");
  }

  const completesAtMs = nowMs + LUMBER_CAMP_BUILD_MS;
  assertTime(completesAtMs);
  const lumberCamp: LumberCamp = {
    id: `lumber-camp:${targetKey}`,
    type: "lumber-camp",
    tileKey: targetKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
    lastProductionAtMs: nowMs,
  };

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - LUMBER_CAMP_WOOD_COST,
        stone: settledState.resources.stone - LUMBER_CAMP_STONE_COST,
      },
      buildings: [...settledState.buildings, lumberCamp],
    },
  };
}

/**
 * Starts a building defined by a module manifest. The rules (terrain, road,
 * cost, build time, production) come only from the manifest; the core knows
 * nothing about individual modules.
 */
export function startModuleBuilding(
  state: GameState,
  manifest: ModuleManifest,
  target: HexCoord,
  nowMs: number,
): StartModuleBuildingResult {
  const settledState = advanceTime(state, nowMs);
  const reject = (reason: StartModuleBuildingRejection): StartModuleBuildingResult => ({
    ok: false,
    reason,
    state: settledState,
  });
  const targetKey = hexKey(target);
  const targetTile = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === targetKey,
  );
  const { building } = manifest;

  if (targetTile === undefined) return reject("tile-not-found");
  if (!building.placement.terrain.includes(targetTile.terrain)) {
    return reject("terrain-not-allowed");
  }
  if (!settledState.visibleTileKeys.includes(targetKey)) return reject("not-visible");
  if (building.placement.requiresRoadConnection && !settledState.roadTileKeys.includes(targetKey)) {
    return reject("road-required");
  }
  if (settledState.buildings.some((entry) => entry.tileKey === targetKey)) {
    return reject("already-built");
  }
  if (
    settledState.modules.some(
      (ref) => ref.id === manifest.id && ref.version !== manifest.version,
    )
  ) {
    return reject("module-version-conflict");
  }
  if (hasOccupiedBuildSlot(settledState)) return reject("build-slot-occupied");
  if (
    settledState.resources.wood < building.cost.wood ||
    settledState.resources.stone < building.cost.stone
  ) {
    return reject("insufficient-resources");
  }

  const completesAtMs = nowMs + building.buildTimeMs;
  assertTime(completesAtMs);
  const moduleBuilding: ModuleBuilding = {
    id: `module:${manifest.id}:${targetKey}`,
    type: "module",
    moduleId: manifest.id,
    moduleVersion: manifest.version,
    tileKey: targetKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
    lastProductionAtMs: nowMs,
    production: {
      resource: building.production.resource,
      amountPerPulse: building.production.amountPerPulse,
    },
  };
  const alreadyReferenced = settledState.modules.some((ref) => ref.id === manifest.id);

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - building.cost.wood,
        stone: settledState.resources.stone - building.cost.stone,
      },
      buildings: [...settledState.buildings, moduleBuilding],
      modules: alreadyReferenced
        ? settledState.modules
        : [...settledState.modules, { id: manifest.id, version: manifest.version }],
    },
  };
}

/** Starts a quarry on a connected, data-driven stone resource site. */
export function startQuarry(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): StartQuarryResult {
  const settledState = advanceTime(state, nowMs);
  const targetKey = hexKey(target);
  const targetTile = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === targetKey,
  );

  if (targetTile === undefined) return quarryRejected(settledState, "tile-not-found");
  if (
    !settledState.world.resourceSites.some(
      (site) => site.type === "stone" && site.tileKey === targetKey,
    )
  ) {
    return quarryRejected(settledState, "not-stone-site");
  }
  if (!settledState.roadTileKeys.includes(targetKey)) {
    return quarryRejected(settledState, "road-required");
  }
  if (settledState.buildings.some((building) => building.tileKey === targetKey)) {
    return quarryRejected(settledState, "already-built");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return quarryRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < QUARRY_WOOD_COST ||
    settledState.resources.stone < QUARRY_STONE_COST
  ) {
    return quarryRejected(settledState, "insufficient-resources");
  }

  const completesAtMs = nowMs + QUARRY_BUILD_MS;
  assertTime(completesAtMs);
  const quarry: Quarry = {
    id: `quarry:${targetKey}`,
    type: "quarry",
    tileKey: targetKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
    lastProductionAtMs: nowMs,
  };

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - QUARRY_WOOD_COST,
        stone: settledState.resources.stone - QUARRY_STONE_COST,
      },
      buildings: [...settledState.buildings, quarry],
    },
  };
}

/** Starts training the single pathfinder at the village. */
export function startPathfinderTraining(
  state: GameState,
  nowMs: number,
): StartPathfinderTrainingResult {
  const settledState = advanceTime(state, nowMs);

  if (settledState.units.some((unit) => unit.type === "pathfinder")) {
    return pathfinderTrainingRejected(settledState, "already-exists");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return pathfinderTrainingRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < PATHFINDER_WOOD_COST ||
    settledState.resources.stone < PATHFINDER_STONE_COST
  ) {
    return pathfinderTrainingRejected(settledState, "insufficient-resources");
  }

  const completesAtMs = nowMs + PATHFINDER_TRAINING_MS;
  assertTime(completesAtMs);
  const pathfinder: Pathfinder = {
    id: "pathfinder",
    type: "pathfinder",
    status: "training",
    tileKey: hexKey(settledState.world.village.coord),
    charges: 0,
    startedAtMs: nowMs,
    completesAtMs,
    lastChargeAtMs: nowMs,
  };

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - PATHFINDER_WOOD_COST,
        stone: settledState.resources.stone - PATHFINDER_STONE_COST,
      },
      units: [...settledState.units, pathfinder],
    },
  };
}

/** Moves the active pathfinder for free within the village-connected road network. */
export function movePathfinder(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): MovePathfinderResult {
  const settledState = advanceTime(state, nowMs);
  const pathfinder = settledState.units.find((unit) => unit.type === "pathfinder");
  if (pathfinder === undefined) {
    return movePathfinderRejected(settledState, "pathfinder-not-found");
  }
  if (pathfinder.status !== "active") {
    return movePathfinderRejected(settledState, "pathfinder-not-active");
  }

  const targetKey = hexKey(target);
  if (!settledState.world.tiles.some((tile) => hexKey(tile.coord) === targetKey)) {
    return movePathfinderRejected(settledState, "tile-not-found");
  }
  if (!connectedRoadNetworkTileKeys(settledState).has(targetKey)) {
    return movePathfinderRejected(settledState, "not-road-network");
  }
  if (pathfinder.tileKey === targetKey) return { ok: true, state: settledState };

  return {
    ok: true,
    state: {
      ...settledState,
      units: settledState.units.map((unit) =>
        unit.id === pathfinder.id ? { ...unit, tileKey: targetKey } : unit,
      ),
    },
  };
}

/** Reveals exactly one unknown second-ring hex without building or claiming. */
export function surveyWithPathfinder(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): SurveyWithPathfinderResult {
  const settledState = advanceTime(state, nowMs);
  const pathfinder = settledState.units.find((unit) => unit.type === "pathfinder");
  if (pathfinder === undefined) {
    return surveyWithPathfinderRejected(settledState, "pathfinder-not-found");
  }
  if (pathfinder.status !== "active") {
    return surveyWithPathfinderRejected(settledState, "pathfinder-not-active");
  }

  if (!isConnectedRoadhead(settledState, pathfinder.tileKey)) {
    return surveyWithPathfinderRejected(settledState, "roadhead-required");
  }

  const targetKey = hexKey(target);
  if (!settledState.world.tiles.some((tile) => hexKey(tile.coord) === targetKey)) {
    return surveyWithPathfinderRejected(settledState, "tile-not-found");
  }
  const pathfinderCoord = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === pathfinder.tileKey,
  )?.coord;
  if (
    pathfinderCoord === undefined ||
    axialDistance(pathfinderCoord, target) !== 2
  ) {
    return surveyWithPathfinderRejected(settledState, "not-in-survey-range");
  }
  if (settledState.visibleTileKeys.includes(targetKey)) {
    return surveyWithPathfinderRejected(settledState, "already-visible");
  }
  if (pathfinder.charges < 1) {
    return surveyWithPathfinderRejected(settledState, "no-charges");
  }

  const nextState: GameState = {
    ...settledState,
    visibleTileKeys: [...settledState.visibleTileKeys, targetKey],
    units: settledState.units.map((unit) =>
      unit.id === pathfinder.id ? { ...unit, charges: unit.charges - 1 } : unit,
    ),
  };

  return {
    ok: true,
    state: reconcilePrologue(nextState, {
      pathfinderSurveyCompleted: true,
      relayDiscovered: targetKey === settledState.world.relaySite.tileKey,
    }),
  };
}

/** Builds the village survey tent, permanently expanding charge storage to 12. */
export function startSurveyTent(
  state: GameState,
  nowMs: number,
): StartSurveyTentResult {
  const settledState = advanceTime(state, nowMs);
  if (settledState.buildings.some((building) => building.type === "survey-tent")) {
    return surveyTentRejected(settledState, "already-built");
  }
  if (
    !settledState.units.some(
      (unit) => unit.type === "pathfinder" && unit.status === "active",
    )
  ) {
    return surveyTentRejected(settledState, "pathfinder-required");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return surveyTentRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < SURVEY_TENT_WOOD_COST ||
    settledState.resources.stone < SURVEY_TENT_STONE_COST
  ) {
    return surveyTentRejected(settledState, "insufficient-resources");
  }

  const tileKey = hexKey(settledState.world.village.coord);
  const completesAtMs = nowMs + SURVEY_TENT_BUILD_MS;
  assertTime(completesAtMs);
  const surveyTent: SurveyTent = {
    id: `survey-tent:${tileKey}`,
    type: "survey-tent",
    tileKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
  };

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - SURVEY_TENT_WOOD_COST,
        stone: settledState.resources.stone - SURVEY_TENT_STONE_COST,
      },
      buildings: [...settledState.buildings, surveyTent],
    },
  };
}

/**
 * Settles every completed 10-minute pulse up to explicit time. The first pulse
 * both completes construction and produces the lumber camp's first two wood.
 */
export function advanceTime(state: GameState, nowMs: number): GameState {
  assertTime(nowMs);
  if (nowMs < state.lastAdvancedAtMs) {
    throw new RangeError("Time cannot move backwards.");
  }
  if (nowMs === state.lastAdvancedAtMs) return state;

  let producedWood = 0;
  let producedStone = 0;
  const buildings = state.buildings.map((building): Building => {
    if (nowMs < building.completesAtMs) return building;

    if (building.type === "survey-tent" || building.type === "workshop") {
      return building.status === "active"
        ? building
        : { ...building, status: "active" };
    }

    const completedPulses = Math.floor(
      (nowMs - building.lastProductionAtMs) / WORLD_PULSE_MS,
    );
    if (building.type === "lumber-camp") {
      producedWood += completedPulses * LUMBER_CAMP_WOOD_PER_PULSE;
    } else if (building.type === "quarry") {
      producedStone += completedPulses * QUARRY_STONE_PER_PULSE;
    } else if (building.type === "module") {
      const produced = completedPulses * building.production.amountPerPulse;
      if (building.production.resource === "wood") producedWood += produced;
      else producedStone += produced;
    }

    return {
      ...building,
      status: "active",
      lastProductionAtMs:
        building.lastProductionAtMs + completedPulses * WORLD_PULSE_MS,
    };
  });

  const surveyTent = state.buildings.find((building) => building.type === "survey-tent");
  const expandedAtMs =
    surveyTent?.status === "active"
      ? Number.NEGATIVE_INFINITY
      : surveyTent !== undefined && surveyTent.completesAtMs <= nowMs
        ? surveyTent.completesAtMs
        : Number.POSITIVE_INFINITY;
  const units = state.units.map((unit): Unit => {
    if (nowMs < unit.completesAtMs) return unit;

    const completedPulses = Math.floor(
      (nowMs - unit.lastChargeAtMs) / WORLD_PULSE_MS,
    );
    const pulsesBeforeExpansion = Number.isFinite(expandedAtMs)
      ? Math.max(
          0,
          Math.min(
            completedPulses,
            Math.ceil(
              (expandedAtMs - unit.lastChargeAtMs) / WORLD_PULSE_MS,
            ) - 1,
          ),
        )
      : expandedAtMs === Number.POSITIVE_INFINITY
        ? completedPulses
        : 0;
    const pulsesAfterExpansion = completedPulses - pulsesBeforeExpansion;
    const chargesAtBaseCapacity = Math.min(
      PATHFINDER_BASE_MAX_CHARGES,
      unit.charges + pulsesBeforeExpansion * PATHFINDER_CHARGES_PER_PULSE,
    );
    const charges = Math.min(
      pulsesAfterExpansion > 0 || expandedAtMs === Number.NEGATIVE_INFINITY
        ? PATHFINDER_EXPANDED_MAX_CHARGES
        : PATHFINDER_BASE_MAX_CHARGES,
      chargesAtBaseCapacity +
        pulsesAfterExpansion * PATHFINDER_CHARGES_PER_PULSE,
    );

    return {
      ...unit,
      status: "active",
      charges,
      lastChargeAtMs:
        unit.lastChargeAtMs + completedPulses * WORLD_PULSE_MS,
    };
  });

  const relay: RelayState =
    state.relay.status === "repairing" && nowMs >= state.relay.completesAtMs
      ? { ...state.relay, status: "active" }
      : state.relay;
  const relayJustRepaired = state.relay.status === "repairing" && relay.status === "active";
  const nextState: GameState = {
    ...state,
    resources:
      producedWood === 0 && producedStone === 0
        ? state.resources
        : {
            wood: Math.min(MAX_WOOD_STORAGE, state.resources.wood + producedWood),
            stone: Math.min(MAX_STONE_STORAGE, state.resources.stone + producedStone),
          },
    buildings,
    units,
    relay,
    lastAdvancedAtMs: nowMs,
  };

  return reconcilePrologue(nextState, {
    stoneProductionObserved: producedStone > 0,
    relayRepaired: relayJustRepaired,
  });
}

function hasOccupiedBuildSlot(state: GameState): boolean {
  return (
    state.buildings.some((building) => building.status === "constructing") ||
    state.units.some((unit) => unit.status === "training") ||
    state.relay.status === "repairing"
  );
}

function connectedRoadNetworkTileKeys(state: GameState): ReadonlySet<string> {
  const roadKeys = new Set(state.roadTileKeys);
  const villageKey = hexKey(state.world.village.coord);
  const connectedKeys = new Set([villageKey]);
  const queue: HexCoord[] = [state.world.village.coord];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) break;
    for (const neighbor of axialNeighbors(current)) {
      const neighborKey = hexKey(neighbor);
      if (!roadKeys.has(neighborKey) || connectedKeys.has(neighborKey)) continue;
      connectedKeys.add(neighborKey);
      queue.push(neighbor);
    }
  }

  return connectedKeys;
}

interface PrologueObservations {
  readonly stoneProductionObserved?: boolean;
  readonly pathfinderSurveyCompleted?: boolean;
  readonly relayDiscovered?: boolean;
  readonly relayRepaired?: boolean;
}

function reconcilePrologue(
  state: GameState,
  observations: PrologueObservations = {},
): GameState {
  const stoneProductionObserved =
    state.prologue.stoneProductionObserved ||
    observations.stoneProductionObserved === true;
  const pathfinderSurveysCompleted =
    state.prologue.pathfinderSurveysCompleted +
    (observations.pathfinderSurveyCompleted === true ? 1 : 0);
  let eventIds = state.prologue.eventIds.includes("relay_discovered")
    ? state.prologue.eventIds
    : observations.relayDiscovered === true
      ? [...state.prologue.eventIds, "relay_discovered" as const]
      : state.prologue.eventIds;
  if (observations.relayRepaired === true && !eventIds.includes("relay_repaired")) {
    eventIds = [...eventIds, "relay_repaired"];
  }

  const completedChapterIds = new Set(state.prologue.completedChapterIds);
  if (stoneProductionObserved && pathfinderSurveysCompleted >= 1) {
    completedChapterIds.add(3);
  }

  const connectedRoadCount = connectedRoadNetworkTileKeys(state).size - 1;
  const hasActiveSurveyTent = state.buildings.some(
    (building) => building.type === "survey-tent" && building.status === "active",
  );
  if (
    completedChapterIds.has(3) &&
    connectedRoadCount >= 8 &&
    hasActiveSurveyTent
  ) {
    completedChapterIds.add(4);
  }
  if (
    completedChapterIds.has(4) &&
    eventIds.includes("relay_discovered")
  ) {
    completedChapterIds.add(5);
  }
  if (
    completedChapterIds.has(5) &&
    state.relay.status === "active" &&
    eventIds.includes("relay_repaired")
  ) {
    completedChapterIds.add(6);
  }
  // Chapter 7 is never derived here: it needs the explicit player action
  // scanFarSignals, so an already completed chapter 7 is only carried over.

  const orderedChapterIds = ([3, 4, 5, 6, 7] as const).filter((chapterId) =>
    completedChapterIds.has(chapterId),
  );
  const unchanged =
    stoneProductionObserved === state.prologue.stoneProductionObserved &&
    pathfinderSurveysCompleted === state.prologue.pathfinderSurveysCompleted &&
    eventIds === state.prologue.eventIds &&
    orderedChapterIds.length === state.prologue.completedChapterIds.length &&
    orderedChapterIds.every(
      (chapterId, index) => state.prologue.completedChapterIds[index] === chapterId,
    );
  if (unchanged) return state;

  return {
    ...state,
    prologue: {
      stoneProductionObserved,
      pathfinderSurveysCompleted,
      completedChapterIds: orderedChapterIds,
      eventIds,
    },
  };
}

function isConnectedRoadhead(state: GameState, tileKey: string): boolean {
  if (!state.roadTileKeys.includes(tileKey)) return false;
  const connectedKeys = connectedRoadNetworkTileKeys(state);
  if (!connectedKeys.has(tileKey)) return false;
  const tile = state.world.tiles.find((candidate) => hexKey(candidate.coord) === tileKey);
  if (tile === undefined) return false;
  const connectedNeighborCount = axialNeighbors(tile.coord).filter((neighbor) =>
    connectedKeys.has(hexKey(neighbor)),
  ).length;
  return connectedNeighborCount <= 1;
}

function axialDistance(first: HexCoord, second: HexCoord): number {
  const deltaQ = first.q - second.q;
  const deltaR = first.r - second.r;
  return (
    Math.abs(deltaQ) + Math.abs(deltaR) + Math.abs(deltaQ + deltaR)
  ) / 2;
}

function isConnectedToRoadNetwork(state: GameState, target: HexCoord): boolean {
  const connectedKeys = new Set(state.roadTileKeys);
  connectedKeys.add(hexKey(state.world.village.coord));

  return axialNeighbors(target).some((neighbor) => connectedKeys.has(hexKey(neighbor)));
}

function rejected(state: GameState, reason: BuildRoadRejection): BuildRoadResult {
  return { ok: false, reason, state };
}

function lumberCampRejected(
  state: GameState,
  reason: StartLumberCampRejection,
): StartLumberCampResult {
  return { ok: false, reason, state };
}

function quarryRejected(
  state: GameState,
  reason: StartQuarryRejection,
): StartQuarryResult {
  return { ok: false, reason, state };
}

function pathfinderTrainingRejected(
  state: GameState,
  reason: StartPathfinderTrainingRejection,
): StartPathfinderTrainingResult {
  return { ok: false, reason, state };
}

function movePathfinderRejected(
  state: GameState,
  reason: MovePathfinderRejection,
): MovePathfinderResult {
  return { ok: false, reason, state };
}

function surveyWithPathfinderRejected(
  state: GameState,
  reason: SurveyWithPathfinderRejection,
): SurveyWithPathfinderResult {
  return { ok: false, reason, state };
}

function surveyTentRejected(
  state: GameState,
  reason: StartSurveyTentRejection,
): StartSurveyTentResult {
  return { ok: false, reason, state };
}

function rotateSignalwerkRuneRejected(
  state: GameState,
  reason: RotateSignalwerkRuneRejection,
): RotateSignalwerkRuneResult {
  return { ok: false, reason, state };
}

function workshopRejected(
  state: GameState,
  reason: StartWorkshopRejection,
): StartWorkshopResult {
  return { ok: false, reason, state };
}

function relayRepairRejected(
  state: GameState,
  reason: StartRelayRepairRejection,
): StartRelayRepairResult {
  return { ok: false, reason, state };
}

function assertTime(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new RangeError("Time must be a non-negative safe integer in milliseconds.");
  }
}

export type TradeResource = keyof ResourceStock;
export const TRADE_RESOURCES: readonly TradeResource[] = ["wood", "stone"];
/** Largest single amount in a trade offer (the server enforces the same limit). */
export const TRADE_MAX_AMOUNT = 50;

const STORAGE_LIMITS: Readonly<Record<TradeResource, number>> = {
  wood: MAX_WOOD_STORAGE,
  stone: MAX_STONE_STORAGE,
};

/** How much of a resource still fits into the storage. */
export function storageRoom(state: GameState, resource: TradeResource): number {
  return Math.max(0, STORAGE_LIMITS[resource] - state.resources[resource]);
}

/** Takes goods out of the stock for a trade; rejected (state unchanged) when there is not enough. */
export function spendForTrade(
  state: GameState,
  resource: TradeResource,
  amount: number,
): { readonly ok: boolean; readonly state: GameState } {
  if (!Number.isInteger(amount) || amount < 1 || state.resources[resource] < amount) {
    return { ok: false, state };
  }
  return {
    ok: true,
    state: { ...state, resources: { ...state.resources, [resource]: state.resources[resource] - amount } },
  };
}

/** Stores delivered goods, never beyond the storage limit. */
export function receiveFromTrade(state: GameState, resource: TradeResource, amount: number): GameState {
  if (!Number.isInteger(amount) || amount < 1) return state;
  const stored = Math.min(amount, storageRoom(state, resource));
  if (stored === 0) return state;
  return { ...state, resources: { ...state.resources, [resource]: state.resources[resource] + stored } };
}
