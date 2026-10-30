import { describe, expect, it } from "vitest";

import {
  axialNeighbors,
  buildRoad,
  createInitialGameState,
  hexKey,
  type GameState,
  type HexTile,
  type Terrain,
  type WorldSnapshot,
} from "./index";

describe("axial hex primitives", () => {
  it("uses a stable coordinate key", () => {
    expect(hexKey({ q: -2, r: 4 })).toBe("-2,4");
  });

  it("returns six unique neighbors in canonical order", () => {
    const neighbors = axialNeighbors({ q: 0, r: 0 });

    expect(neighbors.map(hexKey)).toEqual([
      "1,0",
      "1,-1",
      "0,-1",
      "-1,0",
      "-1,1",
      "0,1",
    ]);
  });
});

describe("road building", () => {
  it("creates progress with the confirmed starting resources", () => {
    const state = createInitialGameState(createWorld());

    expect(state.resources).toEqual({ wood: 12, stone: 6 });
    expect(state.roadTileKeys).toEqual([]);
    expect(state.visibleTileKeys).toEqual(state.world.visibleTileKeys);
    expect(state.visibleTileKeys).not.toBe(state.world.visibleTileKeys);
  });

  it("builds next to the village, spends one wood and reveals neighbors", () => {
    const initial = createInitialGameState(createWorld());
    const result = buildRoad(initial, { q: 1, r: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.resources).toEqual({ wood: 11, stone: 6 });
    expect(result.state.roadTileKeys).toEqual(["1,0"]);
    expect(result.state.visibleTileKeys).toContain("2,0");
    expect(result.state.visibleTileKeys).toContain("2,-1");
    expect(initial.resources).toEqual({ wood: 12, stone: 6 });
    expect(initial.roadTileKeys).toEqual([]);
  });

  it("extends a connected road network", () => {
    const initial = createInitialGameState(createWorld());
    const first = buildRoad(initial, { q: 1, r: 0 });
    if (!first.ok) throw new Error("Expected first road build to succeed.");

    const second = buildRoad(first.state, { q: 2, r: 0 });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.roadTileKeys).toEqual(["1,0", "2,0"]);
    expect(second.state.resources.wood).toBe(10);
  });

  it.each([
    {
      name: "outside the map",
      target: { q: 9, r: 9 },
      expected: "tile-not-found",
    },
    {
      name: "hidden",
      target: { q: 2, r: 0 },
      expected: "not-visible",
    },
    {
      name: "water",
      target: { q: 0, r: 1 },
      expected: "not-traversable",
    },
    {
      name: "village",
      target: { q: 0, r: 0 },
      expected: "village-tile",
    },
  ] as const)("rejects a $name target without changing state", ({ target, expected }) => {
    const initial = createInitialGameState(createWorld());
    const result = buildRoad(initial, target);

    expect(result).toEqual({ ok: false, reason: expected, state: initial });
    expect(result.state).toBe(initial);
  });

  it("rejects visible terrain not connected to village or roads", () => {
    const initial = createInitialGameState(createWorld());
    const state: GameState = {
      ...initial,
      visibleTileKeys: [...initial.visibleTileKeys, "2,0"],
    };

    expect(buildRoad(state, { q: 2, r: 0 })).toEqual({
      ok: false,
      reason: "not-connected",
      state,
    });
  });

  it("rejects duplicate roads and an empty wood stock", () => {
    const initial = createInitialGameState(createWorld());
    const first = buildRoad(initial, { q: 1, r: 0 });
    if (!first.ok) throw new Error("Expected first road build to succeed.");

    expect(buildRoad(first.state, { q: 1, r: 0 })).toEqual({
      ok: false,
      reason: "already-road",
      state: first.state,
    });

    const noWood: GameState = {
      ...initial,
      resources: { wood: 0, stone: initial.resources.stone },
    };
    expect(buildRoad(noWood, { q: 1, r: 0 })).toEqual({
      ok: false,
      reason: "insufficient-wood",
      state: noWood,
    });
  });
});

function createWorld(): WorldSnapshot {
  const terrainOverrides = new Map<string, Terrain>([["0,1", "water"]]);
  const tiles: HexTile[] = [];
  const radius = 2;

  for (let q = -radius; q <= radius; q += 1) {
    const minimumR = Math.max(-radius, -q - radius);
    const maximumR = Math.min(radius, -q + radius);

    for (let r = minimumR; r <= maximumR; r += 1) {
      const coord = { q, r };
      tiles.push({
        coord,
        terrain: terrainOverrides.get(hexKey(coord)) ?? "meadow",
        elevation: 1,
      });
    }
  }

  return {
    seed: "domain-test",
    generatorVersion: "test-v1",
    radius,
    tiles,
    village: { id: "village-0", name: "Testdorf", coord: { q: 0, r: 0 } },
    visibleTileKeys: ["0,0", "1,0", "1,-1", "0,-1", "-1,0", "-1,1", "0,1"],
  };
}
