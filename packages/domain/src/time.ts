import {
  LUMBER_CAMP_WOOD_PER_PULSE,
  MAX_STONE_STORAGE,
  MAX_WOOD_STORAGE,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_CHARGES_PER_PULSE,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  QUARRY_STONE_PER_PULSE,
  WORLD_PULSE_MS,
} from "./constants";
import { assertTime } from "./internal";
import { reconcilePrologue } from "./prologue";
import type { Building, GameState, RelayState, Unit } from "./types";

/**
 * Settles every completed 10-minute pulse up to explicit time. The first pulse
 * both completes construction and produces the lumber camp's first two wood.
 */
export function advanceTime(state: GameState, nowMs: number): GameState {
  assertTime(nowMs);
  if (nowMs < state.lastAdvancedAtMs) {
    throw new RangeError("Time cannot move backwards.");
  }
  if (nowMs === state.lastAdvancedAtMs) return state;

  let producedWood = 0;
  let producedStone = 0;
  const buildings = state.buildings.map((building): Building => {
    if (nowMs < building.completesAtMs) return building;

    if (building.type === "survey-tent" || building.type === "workshop") {
      return building.status === "active"
        ? building
        : { ...building, status: "active" };
    }

    const completedPulses = Math.floor(
      (nowMs - building.lastProductionAtMs) / WORLD_PULSE_MS,
    );
    if (building.type === "lumber-camp") {
      producedWood += completedPulses * LUMBER_CAMP_WOOD_PER_PULSE;
    } else if (building.type === "quarry") {
      producedStone += completedPulses * QUARRY_STONE_PER_PULSE;
    } else if (building.type === "module") {
      const produced = completedPulses * building.production.amountPerPulse;
      if (building.production.resource === "wood") producedWood += produced;
      else producedStone += produced;
    }

    return {
      ...building,
      status: "active",
      lastProductionAtMs:
        building.lastProductionAtMs + completedPulses * WORLD_PULSE_MS,
    };
  });

  const surveyTent = state.buildings.find((building) => building.type === "survey-tent");
  const expandedAtMs =
    surveyTent?.status === "active"
      ? Number.NEGATIVE_INFINITY
      : surveyTent !== undefined && surveyTent.completesAtMs <= nowMs
        ? surveyTent.completesAtMs
        : Number.POSITIVE_INFINITY;
  const units = state.units.map((unit): Unit => {
    if (nowMs < unit.completesAtMs) return unit;

    const completedPulses = Math.floor(
      (nowMs - unit.lastChargeAtMs) / WORLD_PULSE_MS,
    );
    const pulsesBeforeExpansion = Number.isFinite(expandedAtMs)
      ? Math.max(
          0,
          Math.min(
            completedPulses,
            Math.ceil(
              (expandedAtMs - unit.lastChargeAtMs) / WORLD_PULSE_MS,
            ) - 1,
          ),
        )
      : expandedAtMs === Number.POSITIVE_INFINITY
        ? completedPulses
        : 0;
    const pulsesAfterExpansion = completedPulses - pulsesBeforeExpansion;
    const chargesAtBaseCapacity = Math.min(
      PATHFINDER_BASE_MAX_CHARGES,
      unit.charges + pulsesBeforeExpansion * PATHFINDER_CHARGES_PER_PULSE,
    );
    const charges = Math.min(
      pulsesAfterExpansion > 0 || expandedAtMs === Number.NEGATIVE_INFINITY
        ? PATHFINDER_EXPANDED_MAX_CHARGES
        : PATHFINDER_BASE_MAX_CHARGES,
      chargesAtBaseCapacity +
        pulsesAfterExpansion * PATHFINDER_CHARGES_PER_PULSE,
    );

    return {
      ...unit,
      status: "active",
      charges,
      lastChargeAtMs:
        unit.lastChargeAtMs + completedPulses * WORLD_PULSE_MS,
    };
  });

  const relay: RelayState =
    state.relay.status === "repairing" && nowMs >= state.relay.completesAtMs
      ? { ...state.relay, status: "active" }
      : state.relay;
  const relayJustRepaired = state.relay.status === "repairing" && relay.status === "active";
  const nextState: GameState = {
    ...state,
    resources:
      producedWood === 0 && producedStone === 0
        ? state.resources
        : {
            wood: Math.min(MAX_WOOD_STORAGE, state.resources.wood + producedWood),
            stone: Math.min(MAX_STONE_STORAGE, state.resources.stone + producedStone),
          },
    buildings,
    units,
    relay,
    lastAdvancedAtMs: nowMs,
  };

  return reconcilePrologue(nextState, {
    stoneProductionObserved: producedStone > 0,
    relayRepaired: relayJustRepaired,
  });
}
