import { axialNeighbors, hexKey } from "./hex";
import type { GameState, HexCoord } from "./types";

export function hasOccupiedBuildSlot(state: GameState): boolean {
  return (
    state.buildings.some((building) => building.status === "constructing") ||
    state.units.some((unit) => unit.status === "training") ||
    state.relay.status === "repairing"
  );
}

export function connectedRoadNetworkTileKeys(state: GameState): ReadonlySet<string> {
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

export function isConnectedRoadhead(state: GameState, tileKey: string): boolean {
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

export function axialDistance(first: HexCoord, second: HexCoord): number {
  const deltaQ = first.q - second.q;
  const deltaR = first.r - second.r;
  return (
    Math.abs(deltaQ) + Math.abs(deltaR) + Math.abs(deltaQ + deltaR)
  ) / 2;
}

export function isConnectedToRoadNetwork(state: GameState, target: HexCoord): boolean {
  const connectedKeys = new Set(state.roadTileKeys);
  connectedKeys.add(hexKey(state.world.village.coord));

  return axialNeighbors(target).some((neighbor) => connectedKeys.has(hexKey(neighbor)));
}

export function assertTime(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new RangeError("Time must be a non-negative safe integer in milliseconds.");
  }
}
