import { describe, expect, it } from "vitest";

import {
  axialNeighbors,
  buildRoad,
  createInitialGameState,
  hexKey,
  MAX_STONE_STORAGE,
  type GameState,
} from "./index";
import { createWorld } from "./test-fixtures";

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
    expect(state).toMatchObject({
      schemaVersion: 7,
      claimedSurfaceFindTileKeys: [],
      buildings: [],
      units: [],
      signals: [],
      modules: [],
      relay: { status: "dormant", coreInstalled: false },
      prologue: {
        stoneProductionObserved: false,
        pathfinderSurveysCompleted: 0,
        completedChapterIds: [],
        eventIds: [],
      },
      inventory: { resonanceCore: 0 },
      lastAdvancedAtMs: 0,
    });
    expect(state.signalwerk).toMatchObject({
      seed: "domain-test:signalwerk:2,-2",
      solved: false,
    });
    expect(state.signalwerk.rotations).toHaveLength(25);
  });

  it("grants a forest surface find exactly once when the tile is first revealed", () => {
    const initial = createInitialGameState(createWorld(["2,0"]));
    const first = buildRoad(initial, { q: 1, r: 0 });
    if (!first.ok) throw new Error("Expected first road build to succeed.");

    expect(first.state.resources.wood).toBe(12);
    expect(first.state.claimedSurfaceFindTileKeys).toEqual(["2,0"]);

    const overlappingReveal = buildRoad(first.state, { q: 1, r: -1 });
    if (!overlappingReveal.ok) {
      throw new Error("Expected overlapping road build to succeed.");
    }

    expect(overlappingReveal.state.resources.wood).toBe(11);
    expect(overlappingReveal.state.claimedSurfaceFindTileKeys).toEqual(["2,0"]);
  });

  it("grants data-driven stone finds exactly once and respects storage capacity", () => {
    const world = createWorld([], [
      {
        id: "surface-find:stone:2,0",
        resourceType: "stone",
        tileKey: "2,0",
        amount: 4,
      },
    ]);
    const initial: GameState = {
      ...createInitialGameState(world),
      resources: { wood: 12, stone: 149 },
    };
    const first = buildRoad(initial, { q: 1, r: 0 });
    if (!first.ok) throw new Error("Expected first road build to succeed.");

    expect(first.state.resources).toEqual({ wood: 11, stone: MAX_STONE_STORAGE });
    expect(first.state.claimedSurfaceFindTileKeys).toEqual(["2,0"]);

    const overlappingReveal = buildRoad(first.state, { q: 1, r: -1 });
    if (!overlappingReveal.ok) throw new Error("Expected overlapping road.");
    expect(overlappingReveal.state.resources.stone).toBe(MAX_STONE_STORAGE);
    expect(overlappingReveal.state.claimedSurfaceFindTileKeys).toEqual(["2,0"]);
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
