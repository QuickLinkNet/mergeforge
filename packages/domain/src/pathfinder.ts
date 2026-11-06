import {
  PATHFINDER_STONE_COST,
  PATHFINDER_TRAINING_MS,
  PATHFINDER_WOOD_COST,
} from "./constants";
import { hexKey } from "./hex";
import {
  assertTime,
  axialDistance,
  connectedRoadNetworkTileKeys,
  hasOccupiedBuildSlot,
  isConnectedRoadhead,
} from "./internal";
import { reconcilePrologue } from "./prologue";
import { advanceTime } from "./time";
import type {
  GameState,
  HexCoord,
  MovePathfinderRejection,
  MovePathfinderResult,
  Pathfinder,
  StartPathfinderTrainingRejection,
  StartPathfinderTrainingResult,
  SurveyWithPathfinderRejection,
  SurveyWithPathfinderResult,
} from "./types";

/** Starts training the single pathfinder at the village. */
export function startPathfinderTraining(
  state: GameState,
  nowMs: number,
): StartPathfinderTrainingResult {
  const settledState = advanceTime(state, nowMs);

  if (settledState.units.some((unit) => unit.type === "pathfinder")) {
    return pathfinderTrainingRejected(settledState, "already-exists");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return pathfinderTrainingRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < PATHFINDER_WOOD_COST ||
    settledState.resources.stone < PATHFINDER_STONE_COST
  ) {
    return pathfinderTrainingRejected(settledState, "insufficient-resources");
  }

  const completesAtMs = nowMs + PATHFINDER_TRAINING_MS;
  assertTime(completesAtMs);
  const pathfinder: Pathfinder = {
    id: "pathfinder",
    type: "pathfinder",
    status: "training",
    tileKey: hexKey(settledState.world.village.coord),
    charges: 0,
    startedAtMs: nowMs,
    completesAtMs,
    lastChargeAtMs: nowMs,
  };

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - PATHFINDER_WOOD_COST,
        stone: settledState.resources.stone - PATHFINDER_STONE_COST,
      },
      units: [...settledState.units, pathfinder],
    },
  };
}

/** Moves the active pathfinder for free within the village-connected road network. */
export function movePathfinder(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): MovePathfinderResult {
  const settledState = advanceTime(state, nowMs);
  const pathfinder = settledState.units.find((unit) => unit.type === "pathfinder");
  if (pathfinder === undefined) {
    return movePathfinderRejected(settledState, "pathfinder-not-found");
  }
  if (pathfinder.status !== "active") {
    return movePathfinderRejected(settledState, "pathfinder-not-active");
  }

  const targetKey = hexKey(target);
  if (!settledState.world.tiles.some((tile) => hexKey(tile.coord) === targetKey)) {
    return movePathfinderRejected(settledState, "tile-not-found");
  }
  if (!connectedRoadNetworkTileKeys(settledState).has(targetKey)) {
    return movePathfinderRejected(settledState, "not-road-network");
  }
  if (pathfinder.tileKey === targetKey) return { ok: true, state: settledState };

  return {
    ok: true,
    state: {
      ...settledState,
      units: settledState.units.map((unit) =>
        unit.id === pathfinder.id ? { ...unit, tileKey: targetKey } : unit,
      ),
    },
  };
}

/** Reveals exactly one unknown second-ring hex without building or claiming. */
export function surveyWithPathfinder(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): SurveyWithPathfinderResult {
  const settledState = advanceTime(state, nowMs);
  const pathfinder = settledState.units.find((unit) => unit.type === "pathfinder");
  if (pathfinder === undefined) {
    return surveyWithPathfinderRejected(settledState, "pathfinder-not-found");
  }
  if (pathfinder.status !== "active") {
    return surveyWithPathfinderRejected(settledState, "pathfinder-not-active");
  }

  if (!isConnectedRoadhead(settledState, pathfinder.tileKey)) {
    return surveyWithPathfinderRejected(settledState, "roadhead-required");
  }

  const targetKey = hexKey(target);
  if (!settledState.world.tiles.some((tile) => hexKey(tile.coord) === targetKey)) {
    return surveyWithPathfinderRejected(settledState, "tile-not-found");
  }
  const pathfinderCoord = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === pathfinder.tileKey,
  )?.coord;
  if (
    pathfinderCoord === undefined ||
    axialDistance(pathfinderCoord, target) !== 2
  ) {
    return surveyWithPathfinderRejected(settledState, "not-in-survey-range");
  }
  if (settledState.visibleTileKeys.includes(targetKey)) {
    return surveyWithPathfinderRejected(settledState, "already-visible");
  }
  if (pathfinder.charges < 1) {
    return surveyWithPathfinderRejected(settledState, "no-charges");
  }

  const nextState: GameState = {
    ...settledState,
    visibleTileKeys: [...settledState.visibleTileKeys, targetKey],
    units: settledState.units.map((unit) =>
      unit.id === pathfinder.id ? { ...unit, charges: unit.charges - 1 } : unit,
    ),
  };

  return {
    ok: true,
    state: reconcilePrologue(nextState, {
      pathfinderSurveyCompleted: true,
      relayDiscovered: targetKey === settledState.world.relaySite.tileKey,
    }),
  };
}

function pathfinderTrainingRejected(
  state: GameState,
  reason: StartPathfinderTrainingRejection,
): StartPathfinderTrainingResult {
  return { ok: false, reason, state };
}

function movePathfinderRejected(
  state: GameState,
  reason: MovePathfinderRejection,
): MovePathfinderResult {
  return { ok: false, reason, state };
}

function surveyWithPathfinderRejected(
  state: GameState,
  reason: SurveyWithPathfinderRejection,
): SurveyWithPathfinderResult {
  return { ok: false, reason, state };
}
