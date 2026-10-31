import { describe, expect, it } from "vitest";

import { axialNeighbors, hexKey, type WorldSnapshot } from "@mergeforge/domain";

import {
  GENERATOR_VERSION,
  MINIMUM_WORLD_RADIUS,
  RELAY_MAX_DISTANCE,
  RELAY_MIN_DISTANCE,
  STONE_MAX_DISTANCE,
  STONE_MIN_DISTANCE,
  generateWorld,
} from "./index";

describe("generateWorld", () => {
  it("returns equal snapshots for the same seed and radius", () => {
    expect(generateWorld({ seed: "founders-light", radius: 12 })).toEqual(
      generateWorld({ seed: "founders-light", radius: 12 }),
    );
  });

  it("varies terrain for different seeds", () => {
    const firstTerrain = generateWorld({ seed: "amber", radius: 12 }).tiles.map(
      ({ terrain }) => terrain,
    );
    const secondTerrain = generateWorld({ seed: "cobalt", radius: 12 }).tiles.map(
      ({ terrain }) => terrain,
    );

    expect(firstTerrain).not.toEqual(secondTerrain);
  });

  it.each([8, 9, 12])("creates the complete radius-%i hex disk", (radius) => {
    const snapshot = generateWorld({ seed: "tile-count", radius });
    const expectedTileCount = 1 + 3 * radius * (radius + 1);

    expect(snapshot.tiles).toHaveLength(expectedTileCount);
    expect(new Set(snapshot.tiles.map(({ coord }) => hexKey(coord))).size).toBe(
      expectedTileCount,
    );
  });

  it("rejects maps too small to contain the local relay contract", () => {
    expect(() => generateWorld({ seed: "too-small", radius: 7 })).toThrow(
      RangeError,
    );
    expect(() => generateWorld({ seed: "fractional", radius: 8.5 })).toThrow(
      RangeError,
    );
  });

  it("starts with exactly the village and its six neighbors visible", () => {
    const snapshot = generateWorld({ seed: "first-light", radius: 8 });

    expect(snapshot.visibleTileKeys).toEqual([
      "0,0",
      "1,0",
      "1,-1",
      "0,-1",
      "-1,0",
      "-1,1",
      "0,1",
    ]);
    expect(new Set(snapshot.visibleTileKeys).size).toBe(7);
  });

  it("keeps the village and all initially visible neighbors out of water", () => {
    const snapshot = generateWorld({ seed: "deep-water", radius: 8 });
    const initiallyVisible = new Set(snapshot.visibleTileKeys);

    expect(
      snapshot.tiles
        .filter(({ coord }) => initiallyVisible.has(hexKey(coord)))
        .every(({ terrain }) => terrain !== "water"),
    ).toBe(true);
  });

  it("emits versioned, stable and data-driven world objectives", () => {
    const snapshot = generateWorld({ seed: "objective-contract", radius: 12 });
    const repeat = generateWorld({ seed: "objective-contract", radius: 12 });
    const stoneSite = snapshot.resourceSites.find(({ type }) => type === "stone");

    expect(snapshot.generatorVersion).toBe(GENERATOR_VERSION);
    expect(snapshot.resourceSites).toEqual(repeat.resourceSites);
    expect(snapshot.relaySite).toEqual(repeat.relaySite);
    expect(stoneSite).toBeDefined();
    expect(stoneSite?.id).toBe(`stone:${stoneSite?.tileKey}`);
    expect(snapshot.relaySite.id).toBe(`relay:local:${snapshot.relaySite.tileKey}`);
  });

  it.each(Array.from({ length: 128 }, (_, index) => `guarantee-${index}`))(
    "keeps the stone source and relay reachable for seed %s",
    (seed) => {
      const snapshot = generateWorld({ seed, radius: 12 });
      const stoneSite = snapshot.resourceSites.find(({ type }) => type === "stone");
      if (stoneSite === undefined) throw new Error("Missing guaranteed stone site.");

      const stoneDistance = shortestTraversableDistance(snapshot, stoneSite.tileKey);
      const relayDistance = shortestTraversableDistance(
        snapshot,
        snapshot.relaySite.tileKey,
      );

      expect(stoneDistance).toBeGreaterThanOrEqual(STONE_MIN_DISTANCE);
      expect(stoneDistance).toBeLessThanOrEqual(STONE_MAX_DISTANCE);
      expect(relayDistance).toBeGreaterThanOrEqual(RELAY_MIN_DISTANCE);
      expect(relayDistance).toBeLessThanOrEqual(RELAY_MAX_DISTANCE);
      expect(snapshot.visibleTileKeys).not.toContain(snapshot.relaySite.tileKey);
    },
  );

  it("adapts the relay range to the smallest supported world", () => {
    const snapshot = generateWorld({ seed: "minimum-world", radius: MINIMUM_WORLD_RADIUS });

    expect(shortestTraversableDistance(snapshot, snapshot.relaySite.tileKey)).toBe(8);
  });
});

function shortestTraversableDistance(
  snapshot: WorldSnapshot,
  targetTileKey: string,
): number {
  const traversableKeys = new Set(
    snapshot.tiles
      .filter(({ terrain }) => terrain !== "water")
      .map(({ coord }) => hexKey(coord)),
  );
  const startKey = hexKey(snapshot.village.coord);
  const queue: { readonly key: string; readonly distance: number }[] = [
    { key: startKey, distance: 0 },
  ];
  const visited = new Set([startKey]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) break;
    if (current.key === targetTileKey) return current.distance;

    const [qText, rText] = current.key.split(",");
    const coord = { q: Number(qText), r: Number(rText) };
    for (const neighbor of axialNeighbors(coord)) {
      const neighborKey = hexKey(neighbor);
      if (!traversableKeys.has(neighborKey) || visited.has(neighborKey)) continue;
      visited.add(neighborKey);
      queue.push({ key: neighborKey, distance: current.distance + 1 });
    }
  }

  return Number.POSITIVE_INFINITY;
}
