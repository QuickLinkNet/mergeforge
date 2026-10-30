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

export interface WorldSnapshot {
  readonly seed: string;
  readonly generatorVersion: string;
  readonly radius: number;
  readonly tiles: readonly HexTile[];
  readonly village: Village;
  readonly visibleTileKeys: readonly string[];
}

export interface ResourceStock {
  readonly wood: number;
  readonly stone: number;
}

/** Mutable game progress represented as an immutable, serializable value. */
export interface GameState {
  readonly world: WorldSnapshot;
  readonly resources: ResourceStock;
  readonly roadTileKeys: readonly string[];
  readonly visibleTileKeys: readonly string[];
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

export const STARTING_RESOURCES: ResourceStock = {
  wood: 12,
  stone: 6,
};

export const ROAD_WOOD_COST = 1;

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
export function createInitialGameState(world: WorldSnapshot): GameState {
  return {
    world,
    resources: { ...STARTING_RESOURCES },
    roadTileKeys: [],
    visibleTileKeys: [...world.visibleTileKeys],
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

  return {
    ok: true,
    state: {
      ...state,
      resources: {
        ...state.resources,
        wood: state.resources.wood - ROAD_WOOD_COST,
      },
      roadTileKeys: [...state.roadTileKeys, targetKey],
      visibleTileKeys: [...visibleKeys],
    },
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
