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
