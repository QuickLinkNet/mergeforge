import { describe, expect, it } from "vitest";
import { createSignalwerkPuzzle } from "@mergeforge/signalwerk";

import {
  axialNeighbors,
  advanceTime,
  buildRoad,
  createFarSignals,
  createInitialGameState,
  createSimulatedNeighbors,
  describeDistanceBand,
  distanceBandFor,
  hasCompletedChapter,
  hasPrologueEvent,
  hasRelayCapability,
  hexKey,
  scanFarSignals,
  NEIGHBOR_MAX_DISTANCE,
  NEIGHBOR_MIN_DISTANCE,
  SIGNAL_BEARINGS,
  SIGNAL_DISTANCE_BANDS,
  movePathfinder,
  rotateSignalwerkRune,
  startLumberCamp,
  startPathfinderTraining,
  startQuarry,
  startSurveyTent,
  startWorkshop,
  startRelayRepair,
  surveyWithPathfinder,
  LUMBER_CAMP_BUILD_MS,
  MAX_STONE_STORAGE,
  MAX_WOOD_STORAGE,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  PATHFINDER_TRAINING_MS,
  QUARRY_BUILD_MS,
  SURVEY_TENT_BUILD_MS,
  WORKSHOP_BUILD_MS,
  WORKSHOP_STONE_COST,
  WORKSHOP_WOOD_COST,
  RELAY_REPAIR_MS,
  RELAY_REPAIR_STONE_COST,
  RELAY_REPAIR_WOOD_COST,
  WORLD_PULSE_MS,
  type GameState,
  type HexTile,
  type SurveyTent,
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
      schemaVersion: 6,
      claimedSurfaceFindTileKeys: [],
      buildings: [],
      units: [],
      signals: [],
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

describe("Signalwerk domain integration", () => {
  it("keeps rotation locked until both chapter 5 and relay discovery", () => {
    const initial = createInitialGameState(createWorld());
    expect(rotateSignalwerkRune(initial, 0)).toEqual({
      ok: false,
      reason: "locked",
      state: initial,
    });

    const chapterOnly: GameState = {
      ...initial,
      prologue: { ...initial.prologue, completedChapterIds: [3, 4, 5] },
    };
    expect(rotateSignalwerkRune(chapterOnly, 0)).toMatchObject({
      ok: false,
      reason: "locked",
    });

    const eventOnly: GameState = {
      ...initial,
      prologue: { ...initial.prologue, eventIds: ["relay_discovered"] },
    };
    expect(rotateSignalwerkRune(eventOnly, 0)).toMatchObject({
      ok: false,
      reason: "locked",
    });
  });

  it("rotates exactly one of 25 runes by 90 degrees without time or resource cost", () => {
    const unlocked = createUnlockedSignalwerkState();
    const beforeRotations = unlocked.signalwerk.rotations;
    const result = rotateSignalwerkRune(unlocked, 0);
    if (!result.ok) throw new Error("Expected Signalwerk rotation.");

    expect(result.state.signalwerk.rotations).toHaveLength(25);
    expect(result.state.signalwerk.rotations[0]).toBe(
      ((beforeRotations[0] ?? 0) + 1) % 4,
    );
    expect(result.state.signalwerk.rotations.slice(1)).toEqual(
      beforeRotations.slice(1),
    );
    expect(result.state.resources).toBe(unlocked.resources);
    expect(result.state.lastAdvancedAtMs).toBe(unlocked.lastAdvancedAtMs);

    for (const index of [-1, 25, 1.5, Number.NaN]) {
      expect(rotateSignalwerkRune(unlocked, index)).toEqual({
        ok: false,
        reason: "tile-not-found",
        state: unlocked,
      });
    }
  });

  it("awards the unique resonance core and solved event atomically on first solution", () => {
    const unlocked = createUnlockedSignalwerkState();
    const solved = solveSignalwerk(unlocked);

    expect(solved.signalwerk.solved).toBe(true);
    expect(solved.inventory).toEqual({ resonanceCore: 1 });
    expect(solved.prologue.eventIds).toEqual([
      "relay_discovered",
      "signalwerk_solved",
    ]);
    expect(solved.resources).toBe(unlocked.resources);
    expect(solved.lastAdvancedAtMs).toBe(unlocked.lastAdvancedAtMs);
  });

  it("rejects solved puzzles after JSON reload without duplicating event or core", () => {
    const solved = solveSignalwerk(createUnlockedSignalwerkState());
    const reloaded = JSON.parse(JSON.stringify(solved)) as GameState;
    const repeated = rotateSignalwerkRune(reloaded, 0);

    expect(repeated).toEqual({
      ok: false,
      reason: "already-solved",
      state: reloaded,
    });
    expect(
      repeated.state.prologue.eventIds.filter(
        (eventId) => eventId === "signalwerk_solved",
      ),
    ).toHaveLength(1);
    expect(repeated.state.inventory.resonanceCore).toBe(1);
  });
});

describe("workshop and relay repair", () => {
  it("locks the workshop until the Signalwerk is solved", () => {
    const state = createUnlockedSignalwerkState();
    expect(startWorkshop(state, 0)).toMatchObject({ ok: false, reason: "locked" });
  });

  it("builds the village workshop for the confirmed cost and duration", () => {
    const solved = { ...solveSignalwerk(createUnlockedSignalwerkState()), resources: { wood: 30, stone: 30 } };
    const started = startWorkshop(solved, 0);
    if (!started.ok) throw new Error(`Unexpected workshop rejection: ${started.reason}`);

    expect(started.state.resources).toEqual({
      wood: 30 - WORKSHOP_WOOD_COST,
      stone: 30 - WORKSHOP_STONE_COST,
    });
    expect(started.state.buildings.at(-1)).toMatchObject({
      type: "workshop",
      status: "constructing",
      tileKey: "0,0",
      completesAtMs: WORKSHOP_BUILD_MS,
    });
    expect(startWorkshop(started.state, 0)).toMatchObject({ ok: false, reason: "already-built" });

    const active = advanceTime(started.state, WORKSHOP_BUILD_MS);
    expect(active.buildings.at(-1)).toMatchObject({ type: "workshop", status: "active" });
  });

  it("installs the unique core and completes chapter 6 exactly once", () => {
    const solved = { ...solveSignalwerk(createUnlockedSignalwerkState()), resources: { wood: 30, stone: 30 } };
    const workshopOrder = startWorkshop(solved, 0);
    if (!workshopOrder.ok) throw new Error("Expected workshop order.");
    expect(startRelayRepair(workshopOrder.state, 0)).toMatchObject({
      ok: false,
      reason: "workshop-required",
    });

    const workshopActive = advanceTime(workshopOrder.state, WORKSHOP_BUILD_MS);
    const repair = startRelayRepair(workshopActive, WORKSHOP_BUILD_MS);
    if (!repair.ok) throw new Error(`Unexpected repair rejection: ${repair.reason}`);

    expect(repair.state.resources).toEqual({
      wood: 30 - WORKSHOP_WOOD_COST - RELAY_REPAIR_WOOD_COST,
      stone: 30 - WORKSHOP_STONE_COST - RELAY_REPAIR_STONE_COST,
    });
    expect(repair.state.inventory.resonanceCore).toBe(0);
    expect(repair.state.relay).toMatchObject({ status: "repairing", coreInstalled: true });
    expect(startRelayRepair(repair.state, WORKSHOP_BUILD_MS)).toMatchObject({
      ok: false,
      reason: "already-started",
    });

    const completedAt = WORKSHOP_BUILD_MS + RELAY_REPAIR_MS;
    const completed = advanceTime(repair.state, completedAt);
    expect(completed.relay).toMatchObject({ status: "active", coreInstalled: true });
    expect(completed.prologue.eventIds).toEqual([
      "relay_discovered",
      "signalwerk_solved",
      "relay_repaired",
    ]);
    expect(completed.prologue.completedChapterIds).toEqual([3, 4, 5, 6]);

    const reloaded = JSON.parse(JSON.stringify(completed)) as GameState;
    const later = advanceTime(reloaded, completedAt + WORLD_PULSE_MS);
    expect(later.prologue.eventIds.filter((event) => event === "relay_repaired")).toHaveLength(1);
    expect(later.prologue.completedChapterIds.filter((chapter) => chapter === 6)).toHaveLength(1);
  });
});

describe("chapter 7 — the first signal", () => {
  function activeRelayState(): { state: GameState; completedAt: number } {
    const solved = { ...solveSignalwerk(createUnlockedSignalwerkState()), resources: { wood: 30, stone: 30 } };
    const workshopOrder = startWorkshop(solved, 0);
    if (!workshopOrder.ok) throw new Error("Expected workshop order.");
    const workshopActive = advanceTime(workshopOrder.state, WORKSHOP_BUILD_MS);
    const repair = startRelayRepair(workshopActive, WORKSHOP_BUILD_MS);
    if (!repair.ok) throw new Error("Expected repair order.");
    return { state: repair.state, completedAt: WORKSHOP_BUILD_MS + RELAY_REPAIR_MS };
  }

  it("creates identical signals for the same seed and generator version", () => {
    expect(createFarSignals("seed-a", "gen-1")).toEqual(createFarSignals("seed-a", "gen-1"));
    expect(createSimulatedNeighbors("seed-a", "gen-1")).toEqual(
      createSimulatedNeighbors("seed-a", "gen-1"),
    );
  });

  it("varies with seed and generator version", () => {
    const fingerprints = new Set<string>();
    for (let index = 0; index < 40; index += 1) {
      fingerprints.add(JSON.stringify(createFarSignals(`seed-${index}`, "gen-1")));
    }
    expect(fingerprints.size).toBeGreaterThan(10);
    expect(JSON.stringify(createFarSignals("seed-a", "gen-1"))).not.toBe(
      JSON.stringify(createFarSignals("seed-a", "gen-2")),
    );
  });

  it("respects the neighbour distance contract and keeps neighbours apart", () => {
    for (let index = 0; index < 300; index += 1) {
      const neighbors = createSimulatedNeighbors(`seed-${index}`, "gen-1");
      expect(neighbors).toHaveLength(2);
      for (const neighbor of neighbors) {
        expect(neighbor.distanceFields).toBeGreaterThanOrEqual(NEIGHBOR_MIN_DISTANCE);
        expect(neighbor.distanceFields).toBeLessThanOrEqual(NEIGHBOR_MAX_DISTANCE);
      }
      const [first, second] = neighbors;
      expect(first?.bearingIndex).not.toBe(second?.bearingIndex);
    }
  });

  it("exposes only a compass sector and a coarse distance band", () => {
    for (let index = 0; index < 50; index += 1) {
      for (const signal of createFarSignals(`seed-${index}`, "gen-1")) {
        expect(Object.keys(signal).sort()).toEqual(["bearing", "distanceBand", "id"]);
        expect(SIGNAL_BEARINGS).toContain(signal.bearing);
        expect(SIGNAL_DISTANCE_BANDS.map((band) => band.id)).toContain(signal.distanceBand);
      }
    }
    const [first, second] = createSimulatedNeighbors("seed-0", "gen-1");
    const band = createFarSignals("seed-0", "gen-1")[0];
    const expected = SIGNAL_DISTANCE_BANDS.find(
      (candidate) =>
        (first?.distanceFields ?? 0) >= candidate.minFields &&
        (first?.distanceFields ?? 0) <= candidate.maxFields,
    );
    expect(band?.distanceBand).toBe(expected?.id);
    expect(second).toBeDefined();
  });

  it("rejects distances outside the contract range when binning", () => {
    expect(() => distanceBandFor(17)).toThrow(RangeError);
    expect(() => distanceBandFor(25)).toThrow(RangeError);
    expect(describeDistanceBand("near")).toBe("18–20 Felder");
  });

  it("stays locked before the relay is active and has no signals", () => {
    const { state, completedAt } = activeRelayState();
    expect(state.signals).toEqual([]);
    const midway = advanceTime(state, completedAt - 1);
    expect(hasCompletedChapter(midway, 7)).toBe(false);
    expect(midway.signals).toEqual([]);
    expect(hasRelayCapability(midway, "signal_network_active")).toBe(false);
    expect(scanFarSignals(midway, completedAt - 1)).toMatchObject({ ok: false, reason: "locked" });
  });

  it("does not complete chapter 7 by itself, however much time passes", () => {
    const { state, completedAt } = activeRelayState();
    const later = advanceTime(state, completedAt + 50 * WORLD_PULSE_MS);
    expect(hasCompletedChapter(later, 6)).toBe(true);
    expect(hasCompletedChapter(later, 7)).toBe(false);
    expect(later.signals).toEqual([]);
    expect(hasRelayCapability(later, "signal_network_active")).toBe(false);
    expect(hasPrologueEvent(later, "first_signals_received")).toBe(false);
  });

  it("completes chapter 7 through the scan action exactly once with capability and event", () => {
    const { state, completedAt } = activeRelayState();
    const ready = advanceTime(state, completedAt);
    const scan = scanFarSignals(ready, completedAt);
    if (!scan.ok) throw new Error(`Unexpected scan rejection: ${scan.reason}`);
    const completed = scan.state;

    expect(hasCompletedChapter(completed, 7)).toBe(true);
    expect(completed.prologue.completedChapterIds).toEqual([3, 4, 5, 6, 7]);
    expect(hasPrologueEvent(completed, "first_signals_received")).toBe(true);
    expect(hasRelayCapability(completed, "signal_network_active")).toBe(true);
    expect(completed.signals).toEqual(
      createFarSignals(completed.world.seed, completed.world.generatorVersion),
    );

    expect(scanFarSignals(completed, completedAt)).toMatchObject({ ok: false, reason: "already-scanned" });
    const reloaded = JSON.parse(JSON.stringify(completed)) as GameState;
    const later = advanceTime(reloaded, completedAt + 5 * WORLD_PULSE_MS);
    expect(later.prologue.completedChapterIds.filter((chapter) => chapter === 7)).toHaveLength(1);
    expect(later.prologue.eventIds.filter((event) => event === "first_signals_received")).toHaveLength(1);
    expect(later.relay).toMatchObject({ capabilities: ["signal_network_active"] });
    expect(later.signals).toEqual(completed.signals);
    expect(scanFarSignals(later, completedAt + 5 * WORLD_PULSE_MS)).toMatchObject({
      ok: false,
      reason: "already-scanned",
    });
  });

  it("does not change costs, timers or resources when scanning", () => {
    const { state, completedAt } = activeRelayState();
    const ready = advanceTime(state, completedAt);
    const scan = scanFarSignals(ready, completedAt);
    if (!scan.ok) throw new Error("Expected scan.");
    expect(scan.state.resources).toEqual(ready.resources);
    expect(scan.state.buildings).toEqual(ready.buildings);
    expect(scan.state.lastAdvancedAtMs).toBe(ready.lastAdvancedAtMs);
  });
});

function createUnlockedSignalwerkState(): GameState {
  const initial = createInitialGameState(createWorld());
  return {
    ...initial,
    prologue: {
      ...initial.prologue,
      stoneProductionObserved: true,
      pathfinderSurveysCompleted: 1,
      completedChapterIds: [3, 4, 5],
      eventIds: ["relay_discovered"],
    },
  };
}

function solveSignalwerk(state: GameState): GameState {
  const puzzle = createSignalwerkPuzzle(state.signalwerk.seed);
  let current = state;

  for (let index = 0; index < puzzle.solutionRotations.length; index += 1) {
    const solutionRotation = puzzle.solutionRotations[index];
    if (solutionRotation === undefined) throw new Error("Missing solution rotation.");
    while (
      !current.signalwerk.solved &&
      current.signalwerk.rotations[index] !== solutionRotation
    ) {
      const rotated = rotateSignalwerkRune(current, index);
      if (!rotated.ok) throw new Error(`Unexpected rotation rejection: ${rotated.reason}`);
      current = rotated.state;
    }
    if (current.signalwerk.solved) break;
  }

  if (!current.signalwerk.solved) throw new Error("Expected Signalwerk solution.");
  return current;
}

function createRoadheadState(forestTileKeys: readonly string[] = []): GameState {
  const initial = createInitialGameState(createWorld(forestTileKeys));
  const road = buildRoad(initial, { q: 1, r: 0 });
  if (!road.ok) throw new Error("Expected roadhead.");
  return road.state;
}

function withActivePathfinder(
  state: GameState,
  tileKey: string,
  nowMs: number,
): GameState {
  return {
    ...state,
    units: [
      {
        id: "pathfinder",
        type: "pathfinder",
        status: "active",
        tileKey,
        charges: 1,
        startedAtMs: nowMs,
        completesAtMs: nowMs,
        lastChargeAtMs: nowMs,
      },
    ],
  };
}

function createEightConnectedRoadKeys(): readonly string[] {
  return [
    "1,0",
    "2,0",
    "2,-1",
    "2,-2",
    "1,-2",
    "0,-2",
    "-1,-1",
    "-2,0",
  ];
}

function createSurveyTent(status: SurveyTent["status"]): SurveyTent {
  return {
    id: "survey-tent:0,0",
    type: "survey-tent",
    tileKey: "0,0",
    status,
    startedAtMs: 0,
    completesAtMs: status === "constructing" ? WORLD_PULSE_MS : 0,
  };
}

function createChapterFourState(status: SurveyTent["status"]): GameState {
  const initial = createInitialGameState(createWorld());
  return {
    ...initial,
    roadTileKeys: createEightConnectedRoadKeys(),
    buildings: [createSurveyTent(status)],
    prologue: {
      stoneProductionObserved: true,
      pathfinderSurveysCompleted: 1,
      completedChapterIds: [3],
      eventIds: [],
    },
  };
}

function lastProductionAt(state: GameState): number | undefined {
  const building = state.buildings[0];
  return building?.type === "lumber-camp" || building?.type === "quarry"
    ? building.lastProductionAtMs
    : undefined;
}

function createActivePathfinderState(
  forestTileKeys: readonly string[] = [],
): GameState {
  const training = startPathfinderTraining(createRoadheadState(forestTileKeys), 0);
  if (!training.ok) throw new Error("Expected pathfinder training.");
  return advanceTime(training.state, PATHFINDER_TRAINING_MS);
}

function createLumberCampReadyState(): GameState {
  const initial = createInitialGameState(createWorld(["2,0"]));
  const firstRoad = buildRoad(initial, { q: 1, r: 0 });
  if (!firstRoad.ok) throw new Error("Expected first road.");
  const forestRoad = buildRoad(firstRoad.state, { q: 2, r: 0 });
  if (!forestRoad.ok) throw new Error("Expected forest road.");
  return forestRoad.state;
}

function createQuarryReadyState(forestTileKeys: readonly string[] = []): GameState {
  const initial = createInitialGameState(createWorld(forestTileKeys));
  const firstRoad = buildRoad(initial, { q: 1, r: 0 });
  if (!firstRoad.ok) throw new Error("Expected first road.");
  const stoneRoad = buildRoad(firstRoad.state, { q: 2, r: 0 });
  if (!stoneRoad.ok) throw new Error("Expected stone road.");
  return stoneRoad.state;
}

function createWorld(
  forestTileKeys: readonly string[] = [],
  surfaceFinds: WorldSnapshot["surfaceFinds"] = [],
): WorldSnapshot {
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
    resourceSites: [{ id: "stone:2,0", type: "stone", tileKey: "2,0" }],
    relaySite: { id: "relay:local:2,-2", tileKey: "2,-2" },
    surfaceFinds,
  };
}
