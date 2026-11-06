import type { HexCoord, WorldSnapshot } from "@mergeforge/domain";

import { axialKey, type PixelPoint } from "./hex.js";

export function polygonPoints(points: readonly PixelPoint[]): number[] {
  return points.flatMap(({ x, y }) => [x, y]);
}

export function deterministicOffset(q: number, r: number, salt: number): number {
  const mixed = Math.imul(q + salt * 17, 73_856_093) ^ Math.imul(r - salt * 11, 19_349_663);
  return ((mixed >>> 0) % 1_000) / 1_000;
}

export function areNeighbors(left: HexCoord, right: HexCoord): boolean {
  const dq = left.q - right.q;
  const dr = left.r - right.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 1;
}

/** Maps every tile key of the world to its axial coordinate. */
export function tileCoordinateMap(world: WorldSnapshot): Map<string, HexCoord> {
  return new Map(world.tiles.map((tile) => [axialKey(tile.coord), tile.coord]));
}

/** Like drawableCoordinates, but includes fogged tiles (for selection and highlight outlines). */
export function existingCoordinates(world: WorldSnapshot, keys: readonly string[]): Map<string, HexCoord> {
  const requested = new Set(keys);
  const result = new Map<string, HexCoord>();
  for (const tile of world.tiles) {
    if (requested.has(axialKey(tile.coord))) result.set(axialKey(tile.coord), tile.coord);
  }
  return result;
}

export function drawableCoordinates(world: WorldSnapshot, keys: readonly string[]): Map<string, HexCoord> {
  const requested = new Set(keys);
  const visible = new Set(world.visibleTileKeys);
  const result = new Map<string, HexCoord>();
  for (const tile of world.tiles) {
    const key = axialKey(tile.coord);
    if (requested.has(key) && visible.has(key)) {
      result.set(key, tile.coord);
    }
  }
  return result;
}
