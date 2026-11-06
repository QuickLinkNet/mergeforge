import {
  RELAY_REPAIR_MS,
  RELAY_REPAIR_STONE_COST,
  RELAY_REPAIR_WOOD_COST,
  WORKSHOP_BUILD_MS,
  WORKSHOP_STONE_COST,
  WORKSHOP_WOOD_COST,
} from "./constants";
import { hexKey } from "./hex";
import { assertTime, hasOccupiedBuildSlot } from "./internal";
import { createFarSignals } from "./signals";
import { hasCompletedChapter, hasPrologueEvent } from "./state";
import { advanceTime } from "./time";
import type {
  GameState,
  ScanFarSignalsResult,
  StartRelayRepairRejection,
  StartRelayRepairResult,
  StartWorkshopRejection,
  StartWorkshopResult,
  Workshop,
} from "./types";

/** Starts the village workshop after the Signalwerk has yielded its core. */
export function startWorkshop(
  state: GameState,
  nowMs: number,
): StartWorkshopResult {
  const settledState = advanceTime(state, nowMs);
  if (!settledState.signalwerk.solved || !hasPrologueEvent(settledState, "signalwerk_solved")) {
    return workshopRejected(settledState, "locked");
  }
  if (settledState.buildings.some((building) => building.type === "workshop")) {
    return workshopRejected(settledState, "already-built");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return workshopRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < WORKSHOP_WOOD_COST ||
    settledState.resources.stone < WORKSHOP_STONE_COST
  ) {
    return workshopRejected(settledState, "insufficient-resources");
  }
  const tileKey = hexKey(settledState.world.village.coord);
  const completesAtMs = nowMs + WORKSHOP_BUILD_MS;
  assertTime(completesAtMs);
  const workshop: Workshop = {
    id: `workshop:${tileKey}`,
    type: "workshop",
    tileKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
  };
  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - WORKSHOP_WOOD_COST,
        stone: settledState.resources.stone - WORKSHOP_STONE_COST,
      },
      buildings: [...settledState.buildings, workshop],
    },
  };
}

/** Installs the unique core and starts the one-time relay repair. */
export function startRelayRepair(
  state: GameState,
  nowMs: number,
): StartRelayRepairResult {
  const settledState = advanceTime(state, nowMs);
  if (!settledState.signalwerk.solved || !hasCompletedChapter(settledState, 5)) {
    return relayRepairRejected(settledState, "locked");
  }
  const workshop = settledState.buildings.find((building) => building.type === "workshop");
  if (workshop?.status !== "active") {
    return relayRepairRejected(settledState, "workshop-required");
  }
  if (settledState.relay.status !== "dormant") {
    return relayRepairRejected(settledState, "already-started");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return relayRepairRejected(settledState, "build-slot-occupied");
  }
  if (settledState.inventory.resonanceCore !== 1) {
    return relayRepairRejected(settledState, "core-required");
  }
  if (
    settledState.resources.wood < RELAY_REPAIR_WOOD_COST ||
    settledState.resources.stone < RELAY_REPAIR_STONE_COST
  ) {
    return relayRepairRejected(settledState, "insufficient-resources");
  }
  const completesAtMs = nowMs + RELAY_REPAIR_MS;
  assertTime(completesAtMs);
  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - RELAY_REPAIR_WOOD_COST,
        stone: settledState.resources.stone - RELAY_REPAIR_STONE_COST,
      },
      inventory: { resonanceCore: 0 },
      relay: {
        status: "repairing",
        coreInstalled: true,
        startedAtMs: nowMs,
        completesAtMs,
        capabilities: [],
      },
    },
  };
}

/**
 * Chapter 7: the player scans for far signals once the relay is active. Costs
 * nothing; the active relay gains the capability and the two deterministic,
 * coarse signals are revealed, all in one atomic step.
 */
export function scanFarSignals(state: GameState, nowMs: number): ScanFarSignalsResult {
  const settledState = advanceTime(state, nowMs);
  if (settledState.prologue.completedChapterIds.includes(7)) {
    return { ok: false, reason: "already-scanned", state: settledState };
  }
  if (
    !hasCompletedChapter(settledState, 6) ||
    settledState.relay.status !== "active"
  ) {
    return { ok: false, reason: "locked", state: settledState };
  }
  return {
    ok: true,
    state: {
      ...settledState,
      relay: {
        ...settledState.relay,
        capabilities: [...settledState.relay.capabilities, "signal_network_active"],
      },
      signals: createFarSignals(
        settledState.world.seed,
        settledState.world.generatorVersion,
      ),
      prologue: {
        ...settledState.prologue,
        completedChapterIds: [...settledState.prologue.completedChapterIds, 7],
        eventIds: [...settledState.prologue.eventIds, "first_signals_received"],
      },
    },
  };
}

function workshopRejected(
  state: GameState,
  reason: StartWorkshopRejection,
): StartWorkshopResult {
  return { ok: false, reason, state };
}

function relayRepairRejected(
  state: GameState,
  reason: StartRelayRepairRejection,
): StartRelayRepairResult {
  return { ok: false, reason, state };
}
