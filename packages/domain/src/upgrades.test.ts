import { describe, expect, it } from "vitest";

import {
  advanceTime,
  createInitialGameState,
  hasCompletedChapter,
  hasPrologueEvent,
  startLumberUpgrade,
  startQuarryUpgrade,
  startStorehouse,
  yieldPerPulse,
  LUMBER_UPGRADE_BUILD_MS,
  QUARRY_UPGRADE_BUILD_MS,
  WORLD_PULSE_MS,
  type GameState,
  type StartProductionUpgradeResult,
} from "./index";
import { createChapterSevenState, createWorld } from "./test-fixtures";

function ok(result: StartProductionUpgradeResult | ReturnType<typeof startStorehouse>): GameState {
  if (!result.ok) throw new Error(`Expected start, got ${result.reason}.`);
  return result.state;
}

describe("production upgrades", () => {
  it("cost and take the time from the constants", () => {
    expect(LUMBER_UPGRADE_BUILD_MS).toBe(2 * WORLD_PULSE_MS);
    expect(QUARRY_UPGRADE_BUILD_MS).toBe(3 * WORLD_PULSE_MS);
    const lumber = ok(startLumberUpgrade(createChapterSevenState({ wood: 100, stone: 100 }), 0));
    expect(lumber.resources).toEqual({ wood: 50, stone: 80 });
    expect(lumber.buildings.at(-1)).toEqual({
      id: "lumber-upgrade:0,0",
      type: "lumber-upgrade",
      tileKey: "0,0",
      status: "constructing",
      startedAtMs: 0,
      completesAtMs: 2 * WORLD_PULSE_MS,
    });
    const quarry = ok(startQuarryUpgrade(createChapterSevenState({ wood: 100, stone: 100 }), 0));
    expect(quarry.resources).toEqual({ wood: 60, stone: 70 });
    expect(quarry.buildings.at(-1)).toMatchObject({ type: "quarry-upgrade", completesAtMs: 3 * WORLD_PULSE_MS });
  });

  it("needs chapter 7, an active producer, a free slot and resources", () => {
    const initial = createInitialGameState(createWorld(["1,0"]));
    expect(startLumberUpgrade({ ...initial, resources: { wood: 100, stone: 100 } }, 0)).toMatchObject({ reason: "locked" });

    const chapterSeven = createChapterSevenState({ wood: 100, stone: 100 });
    const withoutQuarry = { ...chapterSeven, buildings: chapterSeven.buildings.filter((building) => building.type !== "quarry") };
    expect(startQuarryUpgrade(withoutQuarry, 0)).toMatchObject({ reason: "producer-required" });
    const constructingCamp: GameState = {
      ...chapterSeven,
      buildings: chapterSeven.buildings.map((building) =>
        building.type === "lumber-camp" ? { ...building, status: "constructing", completesAtMs: WORLD_PULSE_MS } : building,
      ),
    };
    expect(startLumberUpgrade(constructingCamp, 0)).toMatchObject({ reason: "producer-required" });

    const busy = ok(startQuarryUpgrade(chapterSeven, 0));
    expect(startLumberUpgrade(busy, 1)).toMatchObject({ reason: "build-slot-occupied" });
    expect(startQuarryUpgrade(busy, 1)).toMatchObject({ reason: "already-built" });
    expect(startLumberUpgrade(createChapterSevenState({ wood: 49, stone: 20 }), 0)).toMatchObject({ reason: "insufficient-resources" });
  });

  it("doubles lumber yield from the pulse at completion on", () => {
    const state = ok(startLumberUpgrade(createChapterSevenState({ wood: 100, stone: 100 }), 0));
    const quarryFree = { ...state, buildings: state.buildings.filter((building) => building.type !== "quarry") };
    expect(advanceTime(quarryFree, WORLD_PULSE_MS).resources.wood).toBe(52);
    expect(advanceTime(quarryFree, 2 * WORLD_PULSE_MS).resources.wood).toBe(56);
    const later = advanceTime(quarryFree, 3 * WORLD_PULSE_MS);
    expect(later.resources.wood).toBe(60);
    const camp = later.buildings.find((building) => building.type === "lumber-camp");
    if (camp?.type !== "lumber-camp") throw new Error("Expected camp.");
    expect(yieldPerPulse(later, camp)).toEqual({ resource: "wood", amount: 4 });
  });

  it("doubles quarry yield and settles the same in one step or many", () => {
    const state = ok(startQuarryUpgrade(createChapterSevenState({ wood: 100, stone: 100 }), 0));
    const direct = advanceTime(state, 7 * WORLD_PULSE_MS + 5);
    let stepwise = state;
    for (let time = 1; time < 7 * WORLD_PULSE_MS; time += 4 * 60_000) stepwise = advanceTime(stepwise, time);
    stepwise = advanceTime(stepwise, 7 * WORLD_PULSE_MS + 5);
    expect(stepwise).toEqual(direct);
    // Pulses at 10 and 20 min yield 1, from 30 min on 2 (5 pulses).
    expect(direct.resources.stone).toBe(70 + 2 + 10);
    expect(direct.resources.wood).toBe(60 + 7 * 2);
  });
});

describe("chapter 8: Das Gründerwerk", () => {
  it("completes once storehouse level 1 and both upgrades are finished", () => {
    let state = createChapterSevenState({ wood: 300, stone: 150 });
    let now = 0;
    state = ok(startStorehouse(state, now));
    now += 3 * WORLD_PULSE_MS;
    state = ok(startLumberUpgrade(state, now));
    now += 2 * WORLD_PULSE_MS;
    state = ok(startQuarryUpgrade(state, now));
    expect(hasCompletedChapter(state, 8)).toBe(false);
    const almost = advanceTime(state, now + 3 * WORLD_PULSE_MS - 1);
    expect(hasCompletedChapter(almost, 8)).toBe(false);

    now += 3 * WORLD_PULSE_MS;
    const done = advanceTime(state, now);
    expect(done.prologue.completedChapterIds).toEqual([3, 4, 5, 6, 7, 8]);
    expect(hasPrologueEvent(done, "founders_works_completed")).toBe(true);
    expect(done.prologue.eventIds.at(-1)).toBe("founders_works_completed");

    // Idempotent: settling again or later never repeats the event.
    expect(advanceTime(done, now)).toBe(done);
    const later = advanceTime(done, now + 5 * WORLD_PULSE_MS);
    expect(later.prologue).toEqual(done.prologue);
    expect(advanceTime(almost, now)).toEqual(done);
  });

  it("still counts a storehouse that is being raised to level 2", () => {
    const base = createChapterSevenState();
    const state: GameState = {
      ...base,
      buildings: [
        ...base.buildings,
        { id: "storehouse:0,0", type: "storehouse", tileKey: "0,0", status: "constructing", level: 2, startedAtMs: 0, completesAtMs: 6 * WORLD_PULSE_MS },
        { id: "lumber-upgrade:0,0", type: "lumber-upgrade", tileKey: "0,0", status: "active", startedAtMs: 0, completesAtMs: 0 },
        { id: "quarry-upgrade:0,0", type: "quarry-upgrade", tileKey: "0,0", status: "active", startedAtMs: 0, completesAtMs: 0 },
      ],
    };
    expect(hasCompletedChapter(advanceTime(state, 1), 8)).toBe(true);
  });

  it("is never granted before chapter 7", () => {
    const base = createChapterSevenState();
    const state: GameState = {
      ...base,
      prologue: { ...base.prologue, completedChapterIds: [3, 4, 5, 6], eventIds: ["relay_discovered", "signalwerk_solved", "relay_repaired"] },
      buildings: [
        ...base.buildings,
        { id: "storehouse:0,0", type: "storehouse", tileKey: "0,0", status: "active", level: 1, startedAtMs: 0, completesAtMs: 0 },
        { id: "lumber-upgrade:0,0", type: "lumber-upgrade", tileKey: "0,0", status: "active", startedAtMs: 0, completesAtMs: 0 },
        { id: "quarry-upgrade:0,0", type: "quarry-upgrade", tileKey: "0,0", status: "active", startedAtMs: 0, completesAtMs: 0 },
      ],
    };
    expect(hasCompletedChapter(advanceTime(state, WORLD_PULSE_MS), 8)).toBe(false);
  });
});
