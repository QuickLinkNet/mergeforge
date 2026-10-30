import { describe, expect, it } from "vitest";

import {
  axialNeighbors,
  advanceTime,
  buildRoad,
  createInitialGameState,
  hexKey,
  startLumberCamp,
  LUMBER_CAMP_BUILD_MS,
  WORLD_PULSE_MS,
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
    expect(state).toMatchObject({
      schemaVersion: 1,
      claimedSurfaceFindTileKeys: [],
      buildings: [],
      lastAdvancedAtMs: 0,
    });
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

describe("lumber camp construction and production", () => {
  it("starts construction on a connected road forest and reserves its costs", () => {
    const ready = createLumberCampReadyState();
    const result = startLumberCamp(ready, { q: 2, r: 0 }, 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.resources).toEqual({ wood: 7, stone: 5 });
    expect(result.state.buildings).toEqual([
      {
        id: "lumber-camp:2,0",
        type: "lumber-camp",
        tileKey: "2,0",
        status: "constructing",
        startedAtMs: 1_000,
        completesAtMs: 1_000 + LUMBER_CAMP_BUILD_MS,
        lastProductionAtMs: 1_000,
      },
    ]);
  });

  it("activates and produces its first two wood on the ten-minute completion pulse", () => {
    const construction = startLumberCamp(
      createLumberCampReadyState(),
      { q: 2, r: 0 },
      1_000,
    );
    if (!construction.ok) throw new Error("Expected lumber camp construction.");

    const completedAt = 1_000 + LUMBER_CAMP_BUILD_MS;
    const completed = advanceTime(construction.state, completedAt);
    expect(completed.buildings[0]?.status).toBe("active");
    expect(completed.resources.wood).toBe(9);

    const firstProduction = advanceTime(completed, completedAt + WORLD_PULSE_MS);
    expect(firstProduction.resources.wood).toBe(11);
  });

  it("catches up offline pulses once without double-producing", () => {
    const construction = startLumberCamp(
      createLumberCampReadyState(),
      { q: 2, r: 0 },
      2_000,
    );
    if (!construction.ok) throw new Error("Expected lumber camp construction.");

    const completedAt = 2_000 + LUMBER_CAMP_BUILD_MS;
    const caughtUp = advanceTime(
      construction.state,
      completedAt + 5 * WORLD_PULSE_MS + WORLD_PULSE_MS / 2,
    );

    expect(caughtUp.resources.wood).toBe(19);
    expect(caughtUp.buildings[0]?.lastProductionAtMs).toBe(
      completedAt + 5 * WORLD_PULSE_MS,
    );
    expect(advanceTime(caughtUp, caughtUp.lastAdvancedAtMs)).toBe(caughtUp);
  });

  it("rejects invalid sites and missing resources", () => {
    const world = createWorld(["2,0", "-1,0"]);
    const initial = createInitialGameState(world);

    expect(startLumberCamp(initial, { q: 9, r: 9 }, 0)).toMatchObject({
      ok: false,
      reason: "tile-not-found",
    });

    expect(startLumberCamp(initial, { q: 2, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "road-required",
    });

    const meadowRoad = buildRoad(initial, { q: 1, r: 0 });
    if (!meadowRoad.ok) throw new Error("Expected meadow road.");
    expect(startLumberCamp(meadowRoad.state, { q: 1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "not-forest",
    });

    const forestRoad = buildRoad(initial, { q: -1, r: 0 });
    if (!forestRoad.ok) throw new Error("Expected forest road.");
    const firstCamp = startLumberCamp(forestRoad.state, { q: -1, r: 0 }, 0);
    if (!firstCamp.ok) throw new Error("Expected first lumber camp.");

    const poor: GameState = {
      ...forestRoad.state,
      resources: { wood: 3, stone: 0 },
    };
    expect(startLumberCamp(poor, { q: -1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "insufficient-resources",
    });
  });

  it("allows only one construction at a time and one building per tile", () => {
    const initial = createInitialGameState(createWorld(["-1,0", "1,0"]));
    const westRoad = buildRoad(initial, { q: -1, r: 0 });
    if (!westRoad.ok) throw new Error("Expected west forest road.");
    const eastRoad = buildRoad(westRoad.state, { q: 1, r: 0 });
    if (!eastRoad.ok) throw new Error("Expected east forest road.");
    const firstCamp = startLumberCamp(eastRoad.state, { q: -1, r: 0 }, 0);
    if (!firstCamp.ok) throw new Error("Expected first lumber camp.");

    expect(startLumberCamp(firstCamp.state, { q: 1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "build-slot-occupied",
    });

    const completed = advanceTime(firstCamp.state, LUMBER_CAMP_BUILD_MS);
    expect(startLumberCamp(completed, { q: -1, r: 0 }, LUMBER_CAMP_BUILD_MS)).toMatchObject({
      ok: false,
      reason: "already-built",
    });
  });

  it("rejects backwards or invalid time", () => {
    const state = createInitialGameState(createWorld(), 5_000);

    expect(() => advanceTime(state, 4_999)).toThrow(RangeError);
    expect(() => advanceTime(state, Number.NaN)).toThrow(RangeError);
  });
});

function createLumberCampReadyState(): GameState {
  const initial = createInitialGameState(createWorld(["2,0"]));
  const firstRoad = buildRoad(initial, { q: 1, r: 0 });
  if (!firstRoad.ok) throw new Error("Expected first road.");
  const forestRoad = buildRoad(firstRoad.state, { q: 2, r: 0 });
  if (!forestRoad.ok) throw new Error("Expected forest road.");
  return forestRoad.state;
}

function createWorld(forestTileKeys: readonly string[] = []): WorldSnapshot {
  const terrainOverrides = new Map<string, Terrain>([["0,1", "water"]]);
  for (const tileKey of forestTileKeys) terrainOverrides.set(tileKey, "forest");
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
