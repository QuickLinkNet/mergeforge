import { describe, expect, it } from "vitest";

import {
  advanceTime,
  buildRoad,
  createInitialGameState,
  hasCompletedChapter,
  hasPrologueEvent,
  startQuarry,
  surveyWithPathfinder,
  QUARRY_BUILD_MS,
  WORLD_PULSE_MS,
  type GameState,
} from "./index";
import {
  createRoadheadState,
  withActivePathfinder,
  createEightConnectedRoadKeys,
  createSurveyTent,
  createChapterFourState,
  createQuarryReadyState,
  createWorld,
} from "./test-fixtures";

describe("prologue chapters and relay discovery", () => {
  it("keeps the relay hidden and all chapter progress empty initially", () => {
    const state = createInitialGameState(createWorld());

    expect(state.visibleTileKeys).not.toContain(state.world.relaySite.tileKey);
    expect(hasPrologueEvent(state, "relay_discovered")).toBe(false);
    expect(state.prologue).toEqual({
      stoneProductionObserved: false,
      pathfinderSurveysCompleted: 0,
      completedChapterIds: [],
      eventIds: [],
    });
  });

  it("completes chapter 3 only after both first stone production and a survey", () => {
    const quarry = startQuarry(createQuarryReadyState(), { q: 2, r: 0 }, 0);
    if (!quarry.ok) throw new Error("Expected quarry construction.");
    const produced = advanceTime(quarry.state, QUARRY_BUILD_MS);

    expect(produced.prologue.stoneProductionObserved).toBe(true);
    expect(hasCompletedChapter(produced, 3)).toBe(false);

    const withPathfinder = withActivePathfinder(produced, "2,0", QUARRY_BUILD_MS);
    const surveyed = surveyWithPathfinder(
      withPathfinder,
      { q: 2, r: -2 },
      QUARRY_BUILD_MS,
    );
    if (!surveyed.ok) throw new Error("Expected pathfinder survey.");

    expect(surveyed.state.prologue.pathfinderSurveysCompleted).toBe(1);
    expect(surveyed.state.prologue.completedChapterIds).toEqual([3]);
    expect(hasPrologueEvent(surveyed.state, "relay_discovered")).toBe(true);
    expect(hasCompletedChapter(surveyed.state, 5)).toBe(false);
  });

  it("also completes chapter 3 when the survey happens before production", () => {
    const ready = withActivePathfinder(createQuarryReadyState(), "2,0", 0);
    const surveyed = surveyWithPathfinder(ready, { q: 2, r: -2 }, 0);
    if (!surveyed.ok) throw new Error("Expected pathfinder survey.");
    expect(hasCompletedChapter(surveyed.state, 3)).toBe(false);

    const quarry = startQuarry(surveyed.state, { q: 2, r: 0 }, 0);
    if (!quarry.ok) throw new Error("Expected quarry construction.");
    const produced = advanceTime(quarry.state, QUARRY_BUILD_MS);

    expect(produced.prologue.completedChapterIds).toEqual([3]);
    expect(produced.prologue.pathfinderSurveysCompleted).toBe(1);
  });

  it("completes chapter 4 only with eight connected roads and an active tent", () => {
    const base = createChapterFourState("constructing");
    const beforeCompletion = advanceTime(base, WORLD_PULSE_MS - 1);
    expect(hasCompletedChapter(beforeCompletion, 4)).toBe(false);

    const completed = advanceTime(beforeCompletion, WORLD_PULSE_MS);
    expect(completed.buildings[0]).toMatchObject({
      type: "survey-tent",
      status: "active",
    });
    expect(completed.prologue.completedChapterIds).toEqual([3, 4]);

    const onlySevenRoads: GameState = {
      ...createChapterFourState("active"),
      roadTileKeys: createChapterFourState("active").roadTileKeys.slice(0, 7),
    };
    const settledSeven = advanceTime(onlySevenRoads, 1);
    expect(hasCompletedChapter(settledSeven, 4)).toBe(false);
  });

  it("discovers the relay through a road exactly once and closes chapter 5 sequentially", () => {
    const initial = createInitialGameState(createWorld());
    const ready: GameState = {
      ...initial,
      prologue: {
        ...initial.prologue,
        stoneProductionObserved: true,
        pathfinderSurveysCompleted: 1,
        completedChapterIds: [3, 4],
      },
    };

    const discovered = buildRoad(ready, { q: 1, r: -1 });
    if (!discovered.ok) throw new Error("Expected relay-revealing road.");
    expect(discovered.state.visibleTileKeys).toContain("2,-2");
    expect(discovered.state.prologue.eventIds).toEqual(["relay_discovered"]);
    expect(discovered.state.prologue.completedChapterIds).toEqual([3, 4, 5]);

    const reloaded = JSON.parse(JSON.stringify(discovered.state)) as GameState;
    const settled = advanceTime(reloaded, WORLD_PULSE_MS);
    expect(
      settled.prologue.eventIds.filter((eventId) => eventId === "relay_discovered"),
    ).toHaveLength(1);
    expect(
      settled.prologue.completedChapterIds.filter((chapterId) => chapterId === 5),
    ).toHaveLength(1);
  });

  it("persists early pathfinder discovery but waits for chapters 3 and 4 before chapter 5", () => {
    const ready = withActivePathfinder(createRoadheadState(), "1,0", 0);
    const discovered = surveyWithPathfinder(ready, { q: 2, r: -2 }, 0);
    if (!discovered.ok) throw new Error("Expected relay survey.");

    expect(discovered.state.prologue.eventIds).toEqual(["relay_discovered"]);
    expect(discovered.state.prologue.completedChapterIds).toEqual([]);

    const conditionsMet: GameState = {
      ...discovered.state,
      roadTileKeys: createEightConnectedRoadKeys(),
      buildings: [createSurveyTent("active")],
      prologue: {
        ...discovered.state.prologue,
        stoneProductionObserved: true,
      },
    };
    const reconciled = advanceTime(conditionsMet, 1);
    expect(reconciled.prologue.completedChapterIds).toEqual([3, 4, 5]);
    expect(reconciled.prologue.eventIds).toEqual(["relay_discovered"]);
  });
});
