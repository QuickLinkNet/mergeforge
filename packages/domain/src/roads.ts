import { FOREST_SURFACE_WOOD, ROAD_WOOD_COST } from "./constants";
import { axialNeighbors, hexKey } from "./hex";
import { isConnectedToRoadNetwork } from "./internal";
import { reconcilePrologue } from "./prologue";
import { storageLimits } from "./storage";
import type { BuildRoadRejection, BuildRoadResult, GameState, HexCoord } from "./types";

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

  const limits = storageLimits(state);
  const nextState: GameState = {
    ...state,
    resources: {
      ...state.resources,
      wood: Math.min(
        limits.wood,
        state.resources.wood -
          ROAD_WOOD_COST +
          newlyVisibleForestKeys.length * FOREST_SURFACE_WOOD,
      ),
      stone: Math.min(limits.stone, state.resources.stone + foundStone),
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

function rejected(state: GameState, reason: BuildRoadRejection): BuildRoadResult {
  return { ok: false, reason, state };
}
