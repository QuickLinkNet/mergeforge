import {
  axialNeighbors,
  hexKey,
  STONE_SURFACE_FIND_TOTAL,
  type HexCoord,
  type HexTile,
  type RelaySite,
  type ResourceSite,
  type SurfaceFind,
  type Terrain,
  type WorldSnapshot,
} from "@mergeforge/domain";

export type { WorldSnapshot } from "@mergeforge/domain";

export const GENERATOR_VERSION = "m2.2-v1";
export const MINIMUM_WORLD_RADIUS = 8;
export const STONE_MIN_DISTANCE = 3;
export const STONE_MAX_DISTANCE = 5;
export const RELAY_MIN_DISTANCE = 8;
export const RELAY_MAX_DISTANCE = 12;

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
const DIRECTIONS = axialNeighbors(ORIGIN);

/**
 * Generates a complete axial hex disk. Output order and values are stable for
 * the same seed, radius and generator version.
 */
export function generateWorld({ seed, radius }: GenerateWorldOptions): WorldSnapshot {
  assertRadius(radius);

  const stoneCoord = selectSiteCoord(
    seed,
    "resource_sites|stone",
    STONE_MIN_DISTANCE,
    STONE_MAX_DISTANCE,
  );
  const relayCoord = selectSiteCoord(
    seed,
    "relays|local",
    RELAY_MIN_DISTANCE,
    Math.min(RELAY_MAX_DISTANCE, radius),
  );
  const stoneSurfaceFindCoords = selectStoneSurfaceFindCoords(
    seed,
    new Set([hexKey(stoneCoord), hexKey(relayCoord)]),
  );
  const forcedTraversableKeys = new Set(INITIAL_VISIBLE_KEYS);
  addStraightPath(forcedTraversableKeys, stoneCoord);
  addStraightPath(forcedTraversableKeys, relayCoord);
  for (const findCoord of stoneSurfaceFindCoords) {
    addStraightPath(forcedTraversableKeys, findCoord);
  }
  const stoneSurfaceFindKeys = new Set(stoneSurfaceFindCoords.map(hexKey));

  const tiles: HexTile[] = [];

  for (let q = -radius; q <= radius; q += 1) {
    const minimumR = Math.max(-radius, -q - radius);
    const maximumR = Math.min(radius, -q + radius);

    for (let r = minimumR; r <= maximumR; r += 1) {
      const coord = { q, r };
      const tileKey = hexKey(coord);
      const value = hash32(`${GENERATOR_VERSION}|${seed}|terrain|${tileKey}`);
      const terrain = stoneSurfaceFindKeys.has(tileKey)
        ? "meadow"
        : terrainFor(value, forcedTraversableKeys.has(tileKey));

      tiles.push({
        coord,
        terrain,
        elevation: elevationFor(terrain, value),
      });
    }
  }

  const stoneKey = hexKey(stoneCoord);
  const relayKey = hexKey(relayCoord);
  const resourceSites: readonly ResourceSite[] = [
    { id: `stone:${stoneKey}`, type: "stone", tileKey: stoneKey },
  ];
  const relaySite: RelaySite = {
    id: `relay:local:${relayKey}`,
    tileKey: relayKey,
  };
  const surfaceFinds: readonly SurfaceFind[] = stoneSurfaceFindCoords.map((coord) => {
    const tileKey = hexKey(coord);
    return {
      id: `surface-find:stone:${tileKey}`,
      resourceType: "stone",
      tileKey,
      amount: 1,
    };
  });

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
    resourceSites,
    relaySite,
    surfaceFinds,
  };
}

function assertRadius(radius: number): void {
  if (!Number.isSafeInteger(radius) || radius < MINIMUM_WORLD_RADIUS) {
    throw new RangeError(
      `World radius must be a safe integer of at least ${MINIMUM_WORLD_RADIUS}.`,
    );
  }
}

function selectSiteCoord(
  seed: string,
  namespace: string,
  minimumDistance: number,
  maximumDistance: number,
): HexCoord {
  const value = hash32(`${GENERATOR_VERSION}|${seed}|${namespace}`);
  const direction = DIRECTIONS[value % DIRECTIONS.length];
  if (direction === undefined) throw new Error("Hex direction contract is empty.");

  const distanceRange = maximumDistance - minimumDistance + 1;
  const distance = minimumDistance + ((value >>> 8) % distanceRange);
  return {
    q: direction.q * distance,
    r: direction.r * distance,
  };
}

function selectStoneSurfaceFindCoords(
  seed: string,
  excludedKeys: ReadonlySet<string>,
): readonly HexCoord[] {
  const candidates: { readonly coord: HexCoord; readonly score: number }[] = [];

  for (let q = -STONE_MAX_DISTANCE; q <= STONE_MAX_DISTANCE; q += 1) {
    const minimumR = Math.max(-STONE_MAX_DISTANCE, -q - STONE_MAX_DISTANCE);
    const maximumR = Math.min(STONE_MAX_DISTANCE, -q + STONE_MAX_DISTANCE);

    for (let r = minimumR; r <= maximumR; r += 1) {
      const coord = { q, r };
      const tileKey = hexKey(coord);
      const distance = axialDistance(ORIGIN, coord);
      if (distance < 2 || distance > STONE_MAX_DISTANCE) continue;
      if (INITIAL_VISIBLE_KEYS.has(tileKey) || excludedKeys.has(tileKey)) continue;

      candidates.push({
        coord,
        score: hash32(`${GENERATOR_VERSION}|${seed}|surface_finds|stone|${tileKey}`),
      });
    }
  }

  candidates.sort(
    (first, second) => {
      const scoreOrder = first.score - second.score;
      if (scoreOrder !== 0) return scoreOrder;
      const firstKey = hexKey(first.coord);
      const secondKey = hexKey(second.coord);
      return firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0;
    },
  );
  const selected = candidates
    .slice(0, STONE_SURFACE_FIND_TOTAL)
    .map(({ coord }) => coord);
  if (selected.length !== STONE_SURFACE_FIND_TOTAL) {
    throw new Error("Unable to place the guaranteed stone surface finds.");
  }
  return selected;
}

function addStraightPath(keys: Set<string>, target: HexCoord): void {
  let current = ORIGIN;
  while (hexKey(current) !== hexKey(target)) {
    const remainingDistance = axialDistance(current, target);
    const next = axialNeighbors(current).find(
      (candidate) => axialDistance(candidate, target) < remainingDistance,
    );
    if (next === undefined) {
      throw new Error(`Unable to create a traversable route to ${hexKey(target)}.`);
    }
    keys.add(hexKey(next));
    current = next;
  }
}

function axialDistance(first: HexCoord, second: HexCoord): number {
  const q = second.q - first.q;
  const r = second.r - first.r;
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
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
