import {
  axialNeighbors,
  hexKey,
  type HexCoord,
  type HexTile,
  type Terrain,
  type WorldSnapshot,
} from "@mergeforge/domain";

export type { WorldSnapshot } from "@mergeforge/domain";

export const GENERATOR_VERSION = "m1.1-v1";

export interface GenerateWorldOptions {
  readonly seed: string;
  readonly radius: number;
}

const ORIGIN: HexCoord = { q: 0, r: 0 };
const INITIAL_VISIBLE_COORDS: readonly HexCoord[] = [
  ORIGIN,
  ...axialNeighbors(ORIGIN),
];
const INITIAL_VISIBLE_KEYS = new Set(INITIAL_VISIBLE_COORDS.map(hexKey));

/**
 * Generates a complete axial hex disk. Output order and values are stable for
 * the same seed, radius and generator version.
 */
export function generateWorld({ seed, radius }: GenerateWorldOptions): WorldSnapshot {
  assertRadius(radius);

  const tiles: HexTile[] = [];

  for (let q = -radius; q <= radius; q += 1) {
    const minimumR = Math.max(-radius, -q - radius);
    const maximumR = Math.min(radius, -q + radius);

    for (let r = minimumR; r <= maximumR; r += 1) {
      const coord = { q, r };
      const value = hash32(`${GENERATOR_VERSION}|${seed}|terrain|${hexKey(coord)}`);
      const terrain = terrainFor(value, INITIAL_VISIBLE_KEYS.has(hexKey(coord)));

      tiles.push({
        coord,
        terrain,
        elevation: elevationFor(terrain, value),
      });
    }
  }

  return {
    seed,
    generatorVersion: GENERATOR_VERSION,
    radius,
    tiles,
    village: {
      id: "village-0",
      name: "Gründerdorf",
      coord: ORIGIN,
    },
    visibleTileKeys: INITIAL_VISIBLE_COORDS.map(hexKey),
  };
}

function assertRadius(radius: number): void {
  if (!Number.isSafeInteger(radius) || radius < 1) {
    throw new RangeError("World radius must be a safe integer of at least 1.");
  }
}

function terrainFor(value: number, mustBeTraversable: boolean): Terrain {
  const bucket = value % 100;

  if (bucket < 44) return "meadow";
  if (bucket < 70) return "forest";
  if (bucket < 90) return "hills";
  return mustBeTraversable ? "meadow" : "water";
}

function elevationFor(terrain: Terrain, value: number): number {
  const variation = (value >>> 8) % 2;

  switch (terrain) {
    case "water":
      return 0;
    case "meadow":
      return 1 + variation;
    case "forest":
      return 2 + variation;
    case "hills":
      return 4 + variation;
  }
}

/** FNV-1a with explicit 32-bit multiplication for cross-runtime stability. */
function hash32(input: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}
