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

export interface WorldSnapshot {
  readonly seed: string;
  readonly generatorVersion: string;
  readonly radius: number;
  readonly tiles: readonly HexTile[];
  readonly village: Village;
  readonly visibleTileKeys: readonly string[];
  readonly resourceSites: readonly ResourceSite[];
  readonly relaySite: RelaySite;
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

export type Building = LumberCamp;

/** Mutable game progress represented as an immutable, serializable value. */
export interface GameState {
  readonly schemaVersion: typeof GAME_STATE_SCHEMA_VERSION;
  readonly world: WorldSnapshot;
  readonly resources: ResourceStock;
  readonly roadTileKeys: readonly string[];
  readonly visibleTileKeys: readonly string[];
  readonly claimedSurfaceFindTileKeys: readonly string[];
  readonly buildings: readonly Building[];
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

export const GAME_STATE_SCHEMA_VERSION = 1 as const;

export const STARTING_RESOURCES: ResourceStock = {
  wood: 12,
  stone: 6,
};

export const ROAD_WOOD_COST = 1;
export const FOREST_SURFACE_WOOD = 1;
export const WORLD_PULSE_MS = 10 * 60 * 1_000;
export const LUMBER_CAMP_BUILD_MS = WORLD_PULSE_MS;
export const LUMBER_CAMP_WOOD_COST = 4;
export const LUMBER_CAMP_STONE_COST = 1;
export const LUMBER_CAMP_WOOD_PER_PULSE = 2;

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

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    world,
    resources: { ...STARTING_RESOURCES },
    roadTileKeys: [],
    visibleTileKeys: [...world.visibleTileKeys],
    claimedSurfaceFindTileKeys: [],
    buildings: [],
    lastAdvancedAtMs: nowMs,
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

  const newlyVisibleForestKeys = [...visibleKeys].filter((tileKey) => {
    if (state.visibleTileKeys.includes(tileKey)) return false;
    if (state.claimedSurfaceFindTileKeys.includes(tileKey)) return false;
    return tilesByKey.get(tileKey)?.terrain === "forest";
  });

  return {
    ok: true,
    state: {
      ...state,
      resources: {
        ...state.resources,
        wood:
          state.resources.wood -
          ROAD_WOOD_COST +
          newlyVisibleForestKeys.length * FOREST_SURFACE_WOOD,
      },
      roadTileKeys: [...state.roadTileKeys, targetKey],
      visibleTileKeys: [...visibleKeys],
      claimedSurfaceFindTileKeys: [
        ...state.claimedSurfaceFindTileKeys,
        ...newlyVisibleForestKeys,
      ],
    },
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
  if (settledState.buildings.some((building) => building.status === "constructing")) {
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
  const buildings = state.buildings.map((building): Building => {
    if (nowMs < building.completesAtMs) return building;

    const completedPulses = Math.floor(
      (nowMs - building.lastProductionAtMs) / WORLD_PULSE_MS,
    );
    producedWood += completedPulses * LUMBER_CAMP_WOOD_PER_PULSE;

    return {
      ...building,
      status: "active",
      lastProductionAtMs:
        building.lastProductionAtMs + completedPulses * WORLD_PULSE_MS,
    };
  });

  return {
    ...state,
    resources:
      producedWood === 0
        ? state.resources
        : { ...state.resources, wood: state.resources.wood + producedWood },
    buildings,
    lastAdvancedAtMs: nowMs,
  };
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

function assertTime(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new RangeError("Time must be a non-negative safe integer in milliseconds.");
  }
}
