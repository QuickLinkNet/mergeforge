import { connectedRoadNetworkTileKeys } from "./internal";
import type { Building, GameState } from "./types";

export interface PrologueObservations {
  readonly stoneProductionObserved?: boolean;
  readonly pathfinderSurveyCompleted?: boolean;
  readonly relayDiscovered?: boolean;
  readonly relayRepaired?: boolean;
}

/** Chapter 8 goal: storehouse level 1 and both production upgrades finished. */
function hasFinishedFoundersWorks(state: GameState): boolean {
  const active = (type: Building["type"]) =>
    state.buildings.some((building) => building.type === type && building.status === "active");
  const storehouse = state.buildings.find((building) => building.type === "storehouse");
  const storehouseReady =
    storehouse?.type === "storehouse" &&
    (storehouse.status === "active" || storehouse.level > 1);
  return storehouseReady && active("lumber-upgrade") && active("quarry-upgrade");
}

export function reconcilePrologue(
  state: GameState,
  observations: PrologueObservations = {},
): GameState {
  const stoneProductionObserved =
    state.prologue.stoneProductionObserved ||
    observations.stoneProductionObserved === true;
  const pathfinderSurveysCompleted =
    state.prologue.pathfinderSurveysCompleted +
    (observations.pathfinderSurveyCompleted === true ? 1 : 0);
  let eventIds = state.prologue.eventIds.includes("relay_discovered")
    ? state.prologue.eventIds
    : observations.relayDiscovered === true
      ? [...state.prologue.eventIds, "relay_discovered" as const]
      : state.prologue.eventIds;
  if (observations.relayRepaired === true && !eventIds.includes("relay_repaired")) {
    eventIds = [...eventIds, "relay_repaired"];
  }

  const completedChapterIds = new Set(state.prologue.completedChapterIds);
  if (stoneProductionObserved && pathfinderSurveysCompleted >= 1) {
    completedChapterIds.add(3);
  }

  const connectedRoadCount = connectedRoadNetworkTileKeys(state).size - 1;
  const hasActiveSurveyTent = state.buildings.some(
    (building) => building.type === "survey-tent" && building.status === "active",
  );
  if (
    completedChapterIds.has(3) &&
    connectedRoadCount >= 8 &&
    hasActiveSurveyTent
  ) {
    completedChapterIds.add(4);
  }
  if (
    completedChapterIds.has(4) &&
    eventIds.includes("relay_discovered")
  ) {
    completedChapterIds.add(5);
  }
  if (
    completedChapterIds.has(5) &&
    state.relay.status === "active" &&
    eventIds.includes("relay_repaired")
  ) {
    completedChapterIds.add(6);
  }
  // Chapter 7 is never derived here: it needs the explicit player action
  // scanFarSignals, so an already completed chapter 7 is only carried over.
  if (completedChapterIds.has(7) && hasFinishedFoundersWorks(state)) {
    completedChapterIds.add(8);
    if (!eventIds.includes("founders_works_completed")) {
      eventIds = [...eventIds, "founders_works_completed"];
    }
  }

  const orderedChapterIds = ([3, 4, 5, 6, 7, 8] as const).filter((chapterId) =>
    completedChapterIds.has(chapterId),
  );
  const unchanged =
    stoneProductionObserved === state.prologue.stoneProductionObserved &&
    pathfinderSurveysCompleted === state.prologue.pathfinderSurveysCompleted &&
    eventIds === state.prologue.eventIds &&
    orderedChapterIds.length === state.prologue.completedChapterIds.length &&
    orderedChapterIds.every(
      (chapterId, index) => state.prologue.completedChapterIds[index] === chapterId,
    );
  if (unchanged) return state;

  return {
    ...state,
    prologue: {
      stoneProductionObserved,
      pathfinderSurveysCompleted,
      completedChapterIds: orderedChapterIds,
      eventIds,
    },
  };
}
