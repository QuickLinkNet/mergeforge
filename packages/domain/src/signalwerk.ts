import {
  createSignalwerkPuzzle,
  isSignalwerkSolved,
  rotateSignalwerkTile,
} from "@mergeforge/signalwerk";
import { hasCompletedChapter, hasPrologueEvent } from "./state";
import type {
  GameState,
  RotateSignalwerkRuneRejection,
  RotateSignalwerkRuneResult,
} from "./types";

/** Rotates one Signalwerk rune and awards the unique core on first solution. */
export function rotateSignalwerkRune(
  state: GameState,
  index: number,
): RotateSignalwerkRuneResult {
  if (
    !hasCompletedChapter(state, 5) ||
    !hasPrologueEvent(state, "relay_discovered")
  ) {
    return rotateSignalwerkRuneRejected(state, "locked");
  }
  if (state.signalwerk.solved) {
    return rotateSignalwerkRuneRejected(state, "already-solved");
  }
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= state.signalwerk.rotations.length
  ) {
    return rotateSignalwerkRuneRejected(state, "tile-not-found");
  }

  const puzzle = createSignalwerkPuzzle(state.signalwerk.seed);
  const rotations = rotateSignalwerkTile(state.signalwerk.rotations, index);
  const solved = isSignalwerkSolved(puzzle, rotations);
  const eventIds =
    solved && !state.prologue.eventIds.includes("signalwerk_solved")
      ? [...state.prologue.eventIds, "signalwerk_solved" as const]
      : state.prologue.eventIds;

  return {
    ok: true,
    state: {
      ...state,
      signalwerk: {
        ...state.signalwerk,
        rotations,
        solved,
      },
      inventory: solved ? { resonanceCore: 1 } : state.inventory,
      prologue:
        eventIds === state.prologue.eventIds
          ? state.prologue
          : { ...state.prologue, eventIds },
    },
  };
}

function rotateSignalwerkRuneRejected(
  state: GameState,
  reason: RotateSignalwerkRuneRejection,
): RotateSignalwerkRuneResult {
  return { ok: false, reason, state };
}
