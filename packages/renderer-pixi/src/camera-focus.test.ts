import { describe, expect, it } from "vitest";
import type { WorldSnapshot } from "@mergeforge/domain";

import { focusPoint } from "./camera.js";
import { axialToPixel } from "./hex.js";
import { HEX_SIZE } from "./theme.js";

const world: WorldSnapshot = {
  seed: "focus-test",
  generatorVersion: "test",
  radius: 3,
  tiles: [
    { coord: { q: 0, r: 0 }, terrain: "meadow", elevation: 1 },
    { coord: { q: 0, r: 1 }, terrain: "meadow", elevation: 1 },
    { coord: { q: 0, r: 2 }, terrain: "meadow", elevation: 1 },
  ],
  village: { id: "village-0", name: "Genesis", coord: { q: 0, r: 0 } },
  visibleTileKeys: ["0,0"],
  resourceSites: [],
  relaySite: { id: "relay", tileKey: "0,2" },
  surfaceFinds: [],
};

describe("focusPoint", () => {
  it("returns the scene position of a single tile", () => {
    expect(focusPoint(world, ["0,2"])).toEqual(axialToPixel({ q: 0, r: 2 }, HEX_SIZE));
  });

  it("averages several tiles", () => {
    const a = axialToPixel({ q: 0, r: 0 }, HEX_SIZE);
    const b = axialToPixel({ q: 0, r: 2 }, HEX_SIZE);
    const point = focusPoint(world, ["0,0", "0,2"]);
    expect(point?.x).toBeCloseTo((a.x + b.x) / 2);
    expect(point?.y).toBeCloseTo((a.y + b.y) / 2);
  });

  it("ignores tiles outside the world and returns null when none match", () => {
    expect(focusPoint(world, ["9,9"])).toBeNull();
    expect(focusPoint(world, [])).toBeNull();
  });
});
