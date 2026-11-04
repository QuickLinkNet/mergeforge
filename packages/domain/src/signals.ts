/**
 * Chapter 7 — deterministic far signals.
 *
 * The two simulated neighbour settlements exist only inside this generator.
 * Only a coarse compass sector and a coarse distance band ever leave it, so
 * no exact coordinate, map or terrain of a foreign sector can be revealed.
 */

export const SIGNAL_GENERATOR_VERSION = "signals-v1";
export const SIGNAL_COUNT = 2;
/** Contract: nearest settlement is 18–24 walkable road fields away. */
export const NEIGHBOR_MIN_DISTANCE = 18;
export const NEIGHBOR_MAX_DISTANCE = 24;

export const SIGNAL_BEARINGS = [
  "east",
  "north-east",
  "north-west",
  "west",
  "south-west",
  "south-east",
] as const;
export type SignalBearing = (typeof SIGNAL_BEARINGS)[number];

/** Coarse distance classes covering the full 18–24 field range. */
export const SIGNAL_DISTANCE_BANDS = [
  { id: "near", minFields: 18, maxFields: 20 },
  { id: "middle", minFields: 21, maxFields: 22 },
  { id: "far", minFields: 23, maxFields: 24 },
] as const;
export type SignalDistanceBand = (typeof SIGNAL_DISTANCE_BANDS)[number]["id"];

/** The only information about a neighbour that is stored or displayed. */
export interface FarSignal {
  readonly id: string;
  readonly bearing: SignalBearing;
  readonly distanceBand: SignalDistanceBand;
}

/** Generator-internal truth. Never persisted, never shown. */
export interface SimulatedNeighbor {
  readonly id: string;
  readonly bearingIndex: number;
  readonly distanceFields: number;
}

export function createSimulatedNeighbors(
  worldSeed: string,
  generatorVersion: string,
): readonly SimulatedNeighbor[] {
  const namespace = `${generatorVersion}|${worldSeed}|${SIGNAL_GENERATOR_VERSION}|signals`;
  const bearingCount = SIGNAL_BEARINGS.length;
  const firstBearing = hash32(`${namespace}|bearing|0`) % bearingCount;
  // The second neighbour lies 2–4 sectors away, never in the same direction.
  const secondBearing =
    (firstBearing + 2 + (hash32(`${namespace}|bearing|1`) % 3)) % bearingCount;
  const bearings = [firstBearing, secondBearing];
  const span = NEIGHBOR_MAX_DISTANCE - NEIGHBOR_MIN_DISTANCE + 1;

  return bearings.map((bearingIndex, index) => ({
    id: `signal:${index}`,
    bearingIndex,
    distanceFields:
      NEIGHBOR_MIN_DISTANCE + (hash32(`${namespace}|distance|${index}`) % span),
  }));
}

export function distanceBandFor(distanceFields: number): SignalDistanceBand {
  const band = SIGNAL_DISTANCE_BANDS.find(
    (candidate) =>
      distanceFields >= candidate.minFields && distanceFields <= candidate.maxFields,
  );
  if (band === undefined) {
    throw new RangeError("Neighbor distance is outside the contract range.");
  }
  return band.id;
}

/** Derives the two coarse signals from world seed and generator version only. */
export function createFarSignals(
  worldSeed: string,
  generatorVersion: string,
): readonly FarSignal[] {
  return createSimulatedNeighbors(worldSeed, generatorVersion).map((neighbor) => {
    const bearing = SIGNAL_BEARINGS[neighbor.bearingIndex];
    if (bearing === undefined) throw new RangeError("Bearing index out of range.");
    return {
      id: neighbor.id,
      bearing,
      distanceBand: distanceBandFor(neighbor.distanceFields),
    };
  });
}

export function describeDistanceBand(band: SignalDistanceBand): string {
  const entry = SIGNAL_DISTANCE_BANDS.find((candidate) => candidate.id === band);
  if (entry === undefined) throw new RangeError("Unknown distance band.");
  return `${entry.minFields}–${entry.maxFields} Felder`;
}

function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  // Final avalanche so the low bits used by modulo are well mixed.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
