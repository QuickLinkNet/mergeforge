import { describe, expect, it } from "vitest";

import {
  advanceTime,
  buildRoad,
  createInitialGameState,
  startLumberCamp,
  startQuarry,
  LUMBER_CAMP_BUILD_MS,
  MAX_STONE_STORAGE,
  MAX_WOOD_STORAGE,
  QUARRY_BUILD_MS,
  WORLD_PULSE_MS,
  type GameState,
} from "./index";
import {
  lastProductionAt,
  createLumberCampReadyState,
  createQuarryReadyState,
  createWorld,
} from "./test-fixtures";

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
    expect(lastProductionAt(caughtUp)).toBe(
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

  it("caps offline wood production without leaving a production backlog", () => {
    const construction = startLumberCamp(
      createLumberCampReadyState(),
      { q: 2, r: 0 },
      0,
    );
    if (!construction.ok) throw new Error("Expected lumber camp construction.");
    const nearlyFull: GameState = {
      ...construction.state,
      resources: { ...construction.state.resources, wood: MAX_WOOD_STORAGE - 1 },
    };

    const settled = advanceTime(nearlyFull, 10 * WORLD_PULSE_MS);
    expect(settled.resources.wood).toBe(MAX_WOOD_STORAGE);
    expect(lastProductionAt(settled)).toBe(10 * WORLD_PULSE_MS);
  });
});

describe("quarry construction and production", () => {
  it("starts on a connected stone site and reserves 3 wood and 1 stone", () => {
    const ready = createQuarryReadyState();
    const result = startQuarry(ready, { q: 2, r: 0 }, 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.resources).toEqual({ wood: 7, stone: 5 });
    expect(result.state.buildings).toEqual([
      {
        id: "quarry:2,0",
        type: "quarry",
        tileKey: "2,0",
        status: "constructing",
        startedAtMs: 1_000,
        completesAtMs: 1_000 + QUARRY_BUILD_MS,
        lastProductionAtMs: 1_000,
      },
    ]);
  });

  it("produces one stone on completion and catches up offline once", () => {
    const construction = startQuarry(createQuarryReadyState(), { q: 2, r: 0 }, 0);
    if (!construction.ok) throw new Error("Expected quarry construction.");

    const completed = advanceTime(construction.state, QUARRY_BUILD_MS);
    expect(completed.buildings[0]?.status).toBe("active");
    expect(completed.resources.stone).toBe(6);

    const caughtUp = advanceTime(completed, 6 * WORLD_PULSE_MS + WORLD_PULSE_MS / 2);
    expect(caughtUp.resources.stone).toBe(11);
    expect(lastProductionAt(caughtUp)).toBe(6 * WORLD_PULSE_MS);
    expect(advanceTime(caughtUp, caughtUp.lastAdvancedAtMs)).toBe(caughtUp);
  });

  it("caps stone production and consumes elapsed pulses without backlog", () => {
    const construction = startQuarry(createQuarryReadyState(), { q: 2, r: 0 }, 0);
    if (!construction.ok) throw new Error("Expected quarry construction.");
    const nearlyFull: GameState = {
      ...construction.state,
      resources: { ...construction.state.resources, stone: MAX_STONE_STORAGE - 1 },
    };

    const settled = advanceTime(nearlyFull, 10 * WORLD_PULSE_MS);
    expect(settled.resources.stone).toBe(MAX_STONE_STORAGE);
    expect(lastProductionAt(settled)).toBe(10 * WORLD_PULSE_MS);
  });

  it("rejects invalid quarry commands without breaking the shared build slot", () => {
    const initial = createInitialGameState(createWorld());
    expect(startQuarry(initial, { q: 9, r: 9 }, 0)).toMatchObject({
      ok: false,
      reason: "tile-not-found",
    });
    expect(startQuarry(initial, { q: 1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "not-stone-site",
    });
    expect(startQuarry(initial, { q: 2, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "road-required",
    });

    const ready = createQuarryReadyState();
    const poor: GameState = { ...ready, resources: { wood: 2, stone: 0 } };
    expect(startQuarry(poor, { q: 2, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "insufficient-resources",
    });

    const readyWithoutForestRoad = createQuarryReadyState(["-1,0"]);
    const forestRoad = buildRoad(readyWithoutForestRoad, { q: -1, r: 0 });
    if (!forestRoad.ok) throw new Error("Expected connected forest road.");
    const quarry = startQuarry(forestRoad.state, { q: 2, r: 0 }, 0);
    if (!quarry.ok) throw new Error("Expected quarry construction.");
    expect(startLumberCamp(quarry.state, { q: -1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "build-slot-occupied",
    });
    expect(startQuarry(quarry.state, { q: 2, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "already-built",
    });
  });
});
