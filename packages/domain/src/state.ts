import { createSignalwerkPuzzle } from "@mergeforge/signalwerk";
import { GAME_STATE_SCHEMA_VERSION, STARTING_RESOURCES } from "./constants";
import { assertTime } from "./internal";
import type {
  GameState,
  PrologueChapterId,
  PrologueEventId,
  RelayCapability,
  WorldSnapshot,
} from "./types";

/** Creates player progress without modifying the generated world snapshot. */
export function createInitialGameState(world: WorldSnapshot, nowMs = 0): GameState {
  assertTime(nowMs);
  const signalwerkSeed = `${world.seed}:signalwerk:${world.relaySite.tileKey}`;
  const signalwerkPuzzle = createSignalwerkPuzzle(signalwerkSeed);

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    world,
    resources: { ...STARTING_RESOURCES },
    roadTileKeys: [],
    visibleTileKeys: [...world.visibleTileKeys],
    claimedSurfaceFindTileKeys: [],
    buildings: [],
    units: [],
    prologue: {
      stoneProductionObserved: false,
      pathfinderSurveysCompleted: 0,
      completedChapterIds: [],
      eventIds: [],
    },
    signalwerk: {
      seed: signalwerkSeed,
      rotations: [...signalwerkPuzzle.initialRotations],
      solved: false,
    },
    inventory: { resonanceCore: 0 },
    relay: { status: "dormant", coreInstalled: false },
    signals: [],
    modules: [],
    lastAdvancedAtMs: nowMs,
  };
}

export function hasCompletedChapter(
  state: GameState,
  chapterId: PrologueChapterId,
): boolean {
  return state.prologue.completedChapterIds.includes(chapterId);
}

export function hasRelayCapability(
  state: GameState,
  capability: RelayCapability,
): boolean {
  return state.relay.status !== "dormant" && state.relay.capabilities.includes(capability);
}

export function hasPrologueEvent(
  state: GameState,
  eventId: PrologueEventId,
): boolean {
  return state.prologue.eventIds.includes(eventId);
}
