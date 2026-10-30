import { describe, expect, it } from "vitest";

import { hexKey } from "@mergeforge/domain";

import { generateWorld } from "./index";

describe("generateWorld", () => {
  it("returns equal snapshots for the same seed and radius", () => {
    expect(generateWorld({ seed: "founders-light", radius: 5 })).toEqual(
      generateWorld({ seed: "founders-light", radius: 5 }),
    );
  });

  it("varies terrain for different seeds", () => {
    const firstTerrain = generateWorld({ seed: "amber", radius: 5 }).tiles.map(
      ({ terrain }) => terrain,
    );
    const secondTerrain = generateWorld({ seed: "cobalt", radius: 5 }).tiles.map(
      ({ terrain }) => terrain,
    );

    expect(firstTerrain).not.toEqual(secondTerrain);
  });

  it.each([1, 2, 5, 8])("creates the complete radius-%i hex disk", (radius) => {
    const snapshot = generateWorld({ seed: "tile-count", radius });
    const expectedTileCount = 1 + 3 * radius * (radius + 1);

    expect(snapshot.tiles).toHaveLength(expectedTileCount);
    expect(new Set(snapshot.tiles.map(({ coord }) => hexKey(coord))).size).toBe(
      expectedTileCount,
    );
  });

  it("starts with exactly the village and its six neighbors visible", () => {
    const snapshot = generateWorld({ seed: "first-light", radius: 5 });

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
    const snapshot = generateWorld({ seed: "deep-water", radius: 5 });
    const initiallyVisible = new Set(snapshot.visibleTileKeys);

    expect(
      snapshot.tiles
        .filter(({ coord }) => initiallyVisible.has(hexKey(coord)))
        .every(({ terrain }) => terrain !== "water"),
    ).toBe(true);
  });
});
