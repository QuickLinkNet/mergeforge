import type { HexCoord } from "./types";

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
