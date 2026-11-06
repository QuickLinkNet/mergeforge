// Shared builders for the domain rule tests (not a test file itself).
import { createSignalwerkPuzzle } from "@mergeforge/signalwerk";

import {
  advanceTime,
  buildRoad,
  createInitialGameState,
  hexKey,
  rotateSignalwerkRune,
  startPathfinderTraining,
  PATHFINDER_TRAINING_MS,
  WORLD_PULSE_MS,
  type GameState,
  type HexTile,
  type SurveyTent,
  type Terrain,
  type WorldSnapshot,
} from "./index";

export function createUnlockedSignalwerkState(): GameState {
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

export function solveSignalwerk(state: GameState): GameState {
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

export function createRoadheadState(forestTileKeys: readonly string[] = []): GameState {
  const initial = createInitialGameState(createWorld(forestTileKeys));
  const road = buildRoad(initial, { q: 1, r: 0 });
  if (!road.ok) throw new Error("Expected roadhead.");
  return road.state;
}

export function withActivePathfinder(
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

export function createEightConnectedRoadKeys(): readonly string[] {
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

export function createSurveyTent(status: SurveyTent["status"]): SurveyTent {
  return {
    id: "survey-tent:0,0",
    type: "survey-tent",
    tileKey: "0,0",
    status,
    startedAtMs: 0,
    completesAtMs: status === "constructing" ? WORLD_PULSE_MS : 0,
  };
}

export function createChapterFourState(status: SurveyTent["status"]): GameState {
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

/**
 * A finished prologue (chapter 7) with an active lumber camp on "1,0" and an
 * active quarry on "2,0", both last produced at time 0.
 */
export function createChapterSevenState(
  resources: GameState["resources"] = { wood: 300, stone: 150 },
): GameState {
  const initial = createInitialGameState(createWorld(["1,0"]));
  return {
    ...initial,
    resources,
    roadTileKeys: ["1,0", "2,0"],
    visibleTileKeys: [...initial.visibleTileKeys, "2,0"],
    buildings: [
      { id: "lumber-camp:1,0", type: "lumber-camp", tileKey: "1,0", status: "active", startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0 },
      { id: "quarry:2,0", type: "quarry", tileKey: "2,0", status: "active", startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0 },
    ],
    relay: { status: "active", coreInstalled: true, startedAtMs: 0, completesAtMs: 0, capabilities: ["signal_network_active"] },
    prologue: {
      stoneProductionObserved: true,
      pathfinderSurveysCompleted: 1,
      completedChapterIds: [3, 4, 5, 6, 7],
      eventIds: ["relay_discovered", "signalwerk_solved", "relay_repaired", "first_signals_received"],
    },
  };
}

export function lastProductionAt(state: GameState): number | undefined {
  const building = state.buildings[0];
  return building?.type === "lumber-camp" || building?.type === "quarry"
    ? building.lastProductionAtMs
    : undefined;
}

export function createActivePathfinderState(
  forestTileKeys: readonly string[] = [],
): GameState {
  const training = startPathfinderTraining(createRoadheadState(forestTileKeys), 0);
  if (!training.ok) throw new Error("Expected pathfinder training.");
  return advanceTime(training.state, PATHFINDER_TRAINING_MS);
}

export function createLumberCampReadyState(): GameState {
  const initial = createInitialGameState(createWorld(["2,0"]));
  const firstRoad = buildRoad(initial, { q: 1, r: 0 });
  if (!firstRoad.ok) throw new Error("Expected first road.");
  const forestRoad = buildRoad(firstRoad.state, { q: 2, r: 0 });
  if (!forestRoad.ok) throw new Error("Expected forest road.");
  return forestRoad.state;
}

export function createQuarryReadyState(forestTileKeys: readonly string[] = []): GameState {
  const initial = createInitialGameState(createWorld(forestTileKeys));
  const firstRoad = buildRoad(initial, { q: 1, r: 0 });
  if (!firstRoad.ok) throw new Error("Expected first road.");
  const stoneRoad = buildRoad(firstRoad.state, { q: 2, r: 0 });
  if (!stoneRoad.ok) throw new Error("Expected stone road.");
  return stoneRoad.state;
}

export function createWorld(
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
