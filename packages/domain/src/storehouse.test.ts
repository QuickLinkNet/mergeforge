import { describe, expect, it } from "vitest";

import {
  advanceTime,
  buildRoad,
  createInitialGameState,
  nextStorehouseLevel,
  receiveFromTrade,
  startStorehouse,
  storageLimits,
  storageRoom,
  storehouseLevel,
  MAX_STORAGE_LIMITS,
  STOREHOUSE_LEVELS,
  WORLD_PULSE_MS,
  type GameState,
} from "./index";
import { createChapterSevenState, createWorld } from "./test-fixtures";

function started(state: GameState, nowMs: number): GameState {
  const result = startStorehouse(state, nowMs);
  if (!result.ok) throw new Error(`Expected storehouse start, got ${result.reason}.`);
  return result.state;
}

describe("storehouse", () => {
  it("is locked until chapter 7 is complete", () => {
    const initial = createInitialGameState(createWorld());
    expect(startStorehouse({ ...initial, resources: { wood: 300, stone: 150 } }, 0)).toMatchObject({
      ok: false,
      reason: "locked",
    });
  });

  it("uses the level costs and build times from the constants", () => {
    expect(STOREHOUSE_LEVELS).toEqual([
      { wood: 60, stone: 30, buildMs: 3 * WORLD_PULSE_MS },
      { wood: 120, stone: 60, buildMs: 6 * WORLD_PULSE_MS },
      { wood: 200, stone: 100, buildMs: 9 * WORLD_PULSE_MS },
    ]);
    const levelOne = started(createChapterSevenState(), 0);
    expect(levelOne.resources).toEqual({ wood: 240, stone: 120 });
    expect(levelOne.buildings.at(-1)).toEqual({
      id: "storehouse:0,0",
      type: "storehouse",
      tileKey: "0,0",
      status: "constructing",
      level: 1,
      startedAtMs: 0,
      completesAtMs: 3 * WORLD_PULSE_MS,
    });
  });

  it("raises the storage limits only after construction is finished", () => {
    const state = started(createChapterSevenState({ wood: 360, stone: 180 }), 0);
    expect(state.resources).toEqual({ wood: 300, stone: 150 });
    expect(storehouseLevel(state)).toBe(0);
    expect(storageLimits(state)).toEqual({ wood: 300, stone: 150 });

    const beforeDone = advanceTime(state, 3 * WORLD_PULSE_MS - 1);
    expect(beforeDone.resources).toEqual({ wood: 300, stone: 150 });
    expect(storageLimits(beforeDone)).toEqual({ wood: 300, stone: 150 });

    // The pulse at the completion time already fills the bigger storage.
    const done = advanceTime(state, 3 * WORLD_PULSE_MS);
    expect(storehouseLevel(done)).toBe(1);
    expect(storageLimits(done)).toEqual({ wood: 450, stone: 225 });
    expect(done.resources).toEqual({ wood: 302, stone: 151 });
    expect(advanceTime(beforeDone, 3 * WORLD_PULSE_MS)).toEqual(done);
  });

  it("settles the same result in one step or pulse by pulse", () => {
    const state = started(createChapterSevenState({ wood: 360, stone: 180 }), 0);
    const target = 12 * WORLD_PULSE_MS + 123;
    let stepwise = state;
    for (let time = 7_000; time < target; time += 7 * 60_000) stepwise = advanceTime(stepwise, time);
    stepwise = advanceTime(stepwise, target);
    const direct = advanceTime(state, target);
    expect(stepwise).toEqual(direct);
    expect(advanceTime(direct, target)).toBe(direct);
    expect(direct.resources).toEqual({ wood: 300 + 10 * 2, stone: 150 + 10 });
  });

  it("upgrades in place through three levels and then stops", () => {
    let state = started(createChapterSevenState(), 0);
    expect(startStorehouse(state, 1)).toMatchObject({ ok: false, reason: "build-slot-occupied" });
    state = advanceTime(state, 3 * WORLD_PULSE_MS);
    expect(nextStorehouseLevel(state)).toBe(2);
    state = started({ ...state, resources: { wood: 450, stone: 225 } }, 3 * WORLD_PULSE_MS);
    expect(state.resources).toEqual({ wood: 330, stone: 165 });
    expect(state.buildings.filter((building) => building.type === "storehouse")).toHaveLength(1);
    expect(storageLimits(state)).toEqual({ wood: 450, stone: 225 });
    state = advanceTime(state, 9 * WORLD_PULSE_MS);
    expect(storageLimits(state)).toEqual({ wood: 600, stone: 300 });
    state = started({ ...state, resources: { wood: 600, stone: 300 } }, 9 * WORLD_PULSE_MS);
    expect(state.buildings.find((building) => building.type === "storehouse")).toMatchObject({
      level: 3,
      completesAtMs: 18 * WORLD_PULSE_MS,
    });
    state = advanceTime(state, 18 * WORLD_PULSE_MS);
    expect(storageLimits(state)).toEqual(MAX_STORAGE_LIMITS);
    expect(MAX_STORAGE_LIMITS).toEqual({ wood: 800, stone: 400 });
    expect(nextStorehouseLevel(state)).toBeNull();
    expect(startStorehouse(state, 18 * WORLD_PULSE_MS)).toMatchObject({ ok: false, reason: "max-level" });
  });

  it("rejects an order without enough resources and keeps the settled state", () => {
    // One pulse of production (+2 wood) is settled first: 57 + 2 = 59 < 60.
    const result = startStorehouse(createChapterSevenState({ wood: 57, stone: 30 }), WORLD_PULSE_MS);
    expect(result).toMatchObject({ ok: false, reason: "insufficient-resources" });
    expect(result.state.lastAdvancedAtMs).toBe(WORLD_PULSE_MS);
  });

  it("lets trade deliveries and road finds use the bigger storage", () => {
    const state = advanceTime(started(createChapterSevenState({ wood: 360, stone: 180 }), 0), 3 * WORLD_PULSE_MS);
    expect(storageRoom(state, "wood")).toBe(450 - state.resources.wood);
    expect(receiveFromTrade(state, "wood", 50).resources.wood).toBe(state.resources.wood + 50);
    const nearlyFull = { ...state, resources: { wood: 440, stone: 220 } };
    expect(receiveFromTrade(nearlyFull, "wood", 50).resources.wood).toBe(450);
    expect(receiveFromTrade(nearlyFull, "stone", 50).resources.stone).toBe(225);

    // Without a storehouse the old limit still caps deliveries.
    const base = createChapterSevenState({ wood: 290, stone: 150 });
    expect(receiveFromTrade(base, "wood", 50).resources.wood).toBe(300);
    expect(storageRoom(base, "stone")).toBe(0);
  });

  it("caps forest finds of a new road at the dynamic limit", () => {
    const world = createWorld(["2,0", "2,-1", "1,1"]);
    const initial = createInitialGameState(world);
    const prepared: GameState = {
      ...initial,
      resources: { wood: 449, stone: 0 },
      buildings: [{ id: "storehouse:0,0", type: "storehouse", tileKey: "0,0", status: "active", level: 1, startedAtMs: 0, completesAtMs: 0 }],
    };
    const road = buildRoad(prepared, { q: 1, r: 0 });
    if (!road.ok) throw new Error("Expected road.");
    // 1 wood spent, three newly seen forest fields give +3, capped at 450.
    expect(road.state.resources.wood).toBe(450);
  });
});
