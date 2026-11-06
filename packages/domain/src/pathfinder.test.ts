import { describe, expect, it } from "vitest";

import {
  advanceTime,
  buildRoad,
  createInitialGameState,
  movePathfinder,
  startLumberCamp,
  startPathfinderTraining,
  startSurveyTent,
  surveyWithPathfinder,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  PATHFINDER_TRAINING_MS,
  SURVEY_TENT_BUILD_MS,
  WORLD_PULSE_MS,
  type GameState,
} from "./index";
import {
  createRoadheadState,
  createActivePathfinderState,
  createWorld,
} from "./test-fixtures";

describe("pathfinder training, movement and survey", () => {
  it("trains exactly one serialized pathfinder for 2 wood and 2 stone", () => {
    const roadState = createRoadheadState();
    const result = startPathfinderTraining(roadState, 0);
    if (!result.ok) throw new Error("Expected pathfinder training to start.");

    expect(result.state.resources).toEqual({ wood: 9, stone: 4 });
    expect(result.state.units).toEqual([
      {
        id: "pathfinder",
        type: "pathfinder",
        status: "training",
        tileKey: "0,0",
        charges: 0,
        startedAtMs: 0,
        completesAtMs: PATHFINDER_TRAINING_MS,
        lastChargeAtMs: 0,
      },
    ]);
    expect(startPathfinderTraining(result.state, 0)).toMatchObject({
      ok: false,
      reason: "already-exists",
    });
  });

  it("shares the construction slot with buildings in both directions", () => {
    const forestRoad = createRoadheadState(["1,0"]);
    const training = startPathfinderTraining(forestRoad, 0);
    if (!training.ok) throw new Error("Expected pathfinder training.");

    expect(startLumberCamp(training.state, { q: 1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "build-slot-occupied",
    });

    const camp = startLumberCamp(forestRoad, { q: 1, r: 0 }, 0);
    if (!camp.ok) throw new Error("Expected lumber camp construction.");
    expect(startPathfinderTraining(camp.state, 0)).toMatchObject({
      ok: false,
      reason: "build-slot-occupied",
    });
  });

  it("grants the first charge at completion and catches up to the base cap once", () => {
    const training = startPathfinderTraining(createRoadheadState(), 0);
    if (!training.ok) throw new Error("Expected pathfinder training.");

    const completed = advanceTime(training.state, PATHFINDER_TRAINING_MS);
    expect(completed.units[0]).toMatchObject({
      status: "active",
      charges: 1,
      lastChargeAtMs: PATHFINDER_TRAINING_MS,
    });

    const offlineAt = WORLD_PULSE_MS * 30;
    const caughtUp = advanceTime(completed, offlineAt);
    expect(caughtUp.units[0]).toMatchObject({
      charges: PATHFINDER_BASE_MAX_CHARGES,
      lastChargeAtMs: offlineAt,
    });
    expect(advanceTime(caughtUp, offlineAt)).toBe(caughtUp);
  });

  it("moves instantly and for free between the village and connected roads", () => {
    const active = createActivePathfinderState();
    const beforeResources = active.resources;
    const moved = movePathfinder(active, { q: 1, r: 0 }, PATHFINDER_TRAINING_MS);
    if (!moved.ok) throw new Error("Expected connected road movement.");

    expect(moved.state.units[0]?.tileKey).toBe("1,0");
    expect(moved.state.resources).toBe(beforeResources);
    const returned = movePathfinder(
      moved.state,
      { q: 0, r: 0 },
      PATHFINDER_TRAINING_MS,
    );
    expect(returned).toMatchObject({ ok: true });
    if (returned.ok) expect(returned.state.units[0]?.tileKey).toBe("0,0");

    expect(
      movePathfinder(active, { q: -1, r: 0 }, PATHFINDER_TRAINING_MS),
    ).toMatchObject({ ok: false, reason: "not-road-network" });
    expect(
      movePathfinder(active, { q: 9, r: 9 }, PATHFINDER_TRAINING_MS),
    ).toMatchObject({ ok: false, reason: "tile-not-found" });
  });

  it("reveals exactly one second-ring hex without roads, ownership or find claims", () => {
    const world = createWorld([], [
      {
        id: "surface-find:stone:2,-2",
        resourceType: "stone",
        tileKey: "2,-2",
        amount: 1,
      },
    ]);
    const initial = createInitialGameState(world);
    const road = buildRoad(initial, { q: 1, r: 0 });
    if (!road.ok) throw new Error("Expected roadhead.");
    const training = startPathfinderTraining(road.state, 0);
    if (!training.ok) throw new Error("Expected pathfinder training.");
    const active = advanceTime(training.state, PATHFINDER_TRAINING_MS);
    const moved = movePathfinder(active, { q: 1, r: 0 }, PATHFINDER_TRAINING_MS);
    if (!moved.ok) throw new Error("Expected pathfinder movement.");

    const surveyed = surveyWithPathfinder(
      moved.state,
      { q: 2, r: -2 },
      PATHFINDER_TRAINING_MS,
    );
    if (!surveyed.ok) throw new Error("Expected second-ring survey.");

    expect(surveyed.state.visibleTileKeys).toEqual([
      ...moved.state.visibleTileKeys,
      "2,-2",
    ]);
    expect(surveyed.state.units[0]?.charges).toBe(0);
    expect(surveyed.state.resources).toBe(moved.state.resources);
    expect(surveyed.state.roadTileKeys).toBe(moved.state.roadTileKeys);
    expect(surveyed.state.claimedSurfaceFindTileKeys).toBe(
      moved.state.claimedSurfaceFindTileKeys,
    );
  });

  it("rejects invalid movement and survey commands with settled state", () => {
    const initial = createRoadheadState();
    expect(movePathfinder(initial, { q: 1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "pathfinder-not-found",
    });

    const training = startPathfinderTraining(initial, 0);
    if (!training.ok) throw new Error("Expected pathfinder training.");
    expect(movePathfinder(training.state, { q: 1, r: 0 }, 0)).toMatchObject({
      ok: false,
      reason: "pathfinder-not-active",
    });

    const active = advanceTime(training.state, PATHFINDER_TRAINING_MS);
    expect(
      surveyWithPathfinder(active, { q: 2, r: -2 }, PATHFINDER_TRAINING_MS),
    ).toMatchObject({ ok: false, reason: "roadhead-required" });
    const moved = movePathfinder(active, { q: 1, r: 0 }, PATHFINDER_TRAINING_MS);
    if (!moved.ok) throw new Error("Expected roadhead movement.");

    expect(
      surveyWithPathfinder(moved.state, { q: -1, r: 0 }, PATHFINDER_TRAINING_MS),
    ).toMatchObject({ ok: false, reason: "already-visible" });
    expect(
      surveyWithPathfinder(moved.state, { q: 2, r: 0 }, PATHFINDER_TRAINING_MS),
    ).toMatchObject({ ok: false, reason: "not-in-survey-range" });
    expect(
      surveyWithPathfinder(moved.state, { q: 9, r: 9 }, PATHFINDER_TRAINING_MS),
    ).toMatchObject({ ok: false, reason: "tile-not-found" });

    const noCharges: GameState = {
      ...moved.state,
      units: moved.state.units.map((unit) => ({ ...unit, charges: 0 })),
    };
    expect(
      surveyWithPathfinder(noCharges, { q: 2, r: -2 }, PATHFINDER_TRAINING_MS),
    ).toMatchObject({ ok: false, reason: "no-charges" });
  });
});

describe("survey tent construction and expanded charge storage", () => {
  it("requires an active pathfinder and builds in the village for 3 wood and 1 stone", () => {
    const roadState = createRoadheadState();
    expect(startSurveyTent(roadState, 0)).toMatchObject({
      ok: false,
      reason: "pathfinder-required",
    });

    const active = createActivePathfinderState();
    const result = startSurveyTent(active, PATHFINDER_TRAINING_MS);
    if (!result.ok) throw new Error("Expected survey tent construction.");

    expect(result.state.resources).toEqual({ wood: 6, stone: 3 });
    expect(result.state.buildings.at(-1)).toEqual({
      id: "survey-tent:0,0",
      type: "survey-tent",
      tileKey: "0,0",
      status: "constructing",
      startedAtMs: PATHFINDER_TRAINING_MS,
      completesAtMs: PATHFINDER_TRAINING_MS + SURVEY_TENT_BUILD_MS,
    });
    expect(startSurveyTent(result.state, PATHFINDER_TRAINING_MS)).toMatchObject({
      ok: false,
      reason: "already-built",
    });
  });

  it("raises capacity to 12 without an instant refill and settles offline once", () => {
    const training = startPathfinderTraining(createRoadheadState(), 0);
    if (!training.ok) throw new Error("Expected pathfinder training.");
    const fullAt = WORLD_PULSE_MS * PATHFINDER_BASE_MAX_CHARGES;
    const full = advanceTime(training.state, fullAt);
    expect(full.units[0]?.charges).toBe(PATHFINDER_BASE_MAX_CHARGES);

    const tentStartedAt = fullAt + WORLD_PULSE_MS / 2;
    const tent = startSurveyTent(full, tentStartedAt);
    if (!tent.ok) throw new Error("Expected survey tent construction.");
    const tentCompletedAt = tentStartedAt + SURVEY_TENT_BUILD_MS;
    const completed = advanceTime(tent.state, tentCompletedAt);
    expect(completed.buildings.at(-1)?.status).toBe("active");
    expect(completed.units[0]?.charges).toBe(PATHFINDER_BASE_MAX_CHARGES);

    const nextChargeAt = fullAt + WORLD_PULSE_MS * 2;
    const firstExpandedCharge = advanceTime(completed, nextChargeAt);
    expect(firstExpandedCharge.units[0]?.charges).toBe(
      PATHFINDER_BASE_MAX_CHARGES + 1,
    );

    const offlineAt = nextChargeAt + WORLD_PULSE_MS * 50;
    const caughtUp = advanceTime(firstExpandedCharge, offlineAt);
    expect(caughtUp.units[0]).toMatchObject({
      charges: PATHFINDER_EXPANDED_MAX_CHARGES,
      lastChargeAtMs: offlineAt,
    });
    expect(advanceTime(caughtUp, offlineAt)).toBe(caughtUp);
  });

  it("enforces resources and the shared construction slot", () => {
    const active = createActivePathfinderState(["1,0"]);
    const poor: GameState = { ...active, resources: { wood: 2, stone: 0 } };
    expect(startSurveyTent(poor, PATHFINDER_TRAINING_MS)).toMatchObject({
      ok: false,
      reason: "insufficient-resources",
    });

    const camp = startLumberCamp(active, { q: 1, r: 0 }, PATHFINDER_TRAINING_MS);
    if (!camp.ok) throw new Error("Expected lumber camp construction.");
    expect(startSurveyTent(camp.state, PATHFINDER_TRAINING_MS)).toMatchObject({
      ok: false,
      reason: "build-slot-occupied",
    });
  });
});
