import {
  LUMBER_CAMP_WOOD_PER_PULSE,
  LUMBER_UPGRADE_WOOD_PER_PULSE,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_CHARGES_PER_PULSE,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  QUARRY_STONE_PER_PULSE,
  QUARRY_UPGRADE_STONE_PER_PULSE,
  WORLD_PULSE_MS,
} from "./constants";
import { assertTime } from "./internal";
import { findProductionUpgrade, isVillageBuilding } from "./production";
import { reconcilePrologue } from "./prologue";
import { findStorehouse, storageLimits, storageLimitsAtLevel } from "./storage";
import type { Building, GameState, RelayState, Unit } from "./types";

/**
 * Settles every completed 10-minute pulse up to explicit time. The first pulse
 * both completes construction and produces the lumber camp's first two wood.
 *
 * Production and storage are settled per pulse time, so splitting one advance
 * into several never changes the result: a pulse at or after the completion of
 * a production upgrade yields the upgraded amount, and a storehouse level only
 * raises the storage limit for pulses at or after its completion.
 */
export function advanceTime(state: GameState, nowMs: number): GameState {
  assertTime(nowMs);
  if (nowMs < state.lastAdvancedAtMs) {
    throw new RangeError("Time cannot move backwards.");
  }
  if (nowMs === state.lastAdvancedAtMs) return state;

  const lumberUpgradeAtMs = findProductionUpgrade(state, "lumber-upgrade")?.completesAtMs ?? Number.POSITIVE_INFINITY;
  const quarryUpgradeAtMs = findProductionUpgrade(state, "quarry-upgrade")?.completesAtMs ?? Number.POSITIVE_INFINITY;
  const storehouse = findStorehouse(state);
  const limitsBefore = storageLimits(state);
  const limitRaisedAtMs =
    storehouse?.status === "constructing" && storehouse.completesAtMs <= nowMs
      ? storehouse.completesAtMs
      : Number.POSITIVE_INFINITY;
  const limitsAfter =
    storehouse !== undefined && Number.isFinite(limitRaisedAtMs)
      ? storageLimitsAtLevel(storehouse.level)
      : limitsBefore;

  const produced = { woodBefore: 0, woodAfter: 0, stoneBefore: 0, stoneAfter: 0 };
  const buildings = state.buildings.map((building): Building => {
    if (nowMs < building.completesAtMs) return building;

    if (isVillageBuilding(building)) {
      return building.status === "active"
        ? building
        : { ...building, status: "active" };
    }

    const completedPulses = Math.floor(
      (nowMs - building.lastProductionAtMs) / WORLD_PULSE_MS,
    );
    const pulses = { last: building.lastProductionAtMs, count: completedPulses };
    if (building.type === "lumber-camp") {
      const before = yieldBefore(pulses, limitRaisedAtMs, LUMBER_CAMP_WOOD_PER_PULSE, LUMBER_UPGRADE_WOOD_PER_PULSE, lumberUpgradeAtMs);
      const total = yieldBefore(pulses, Number.POSITIVE_INFINITY, LUMBER_CAMP_WOOD_PER_PULSE, LUMBER_UPGRADE_WOOD_PER_PULSE, lumberUpgradeAtMs);
      produced.woodBefore += before;
      produced.woodAfter += total - before;
    } else if (building.type === "quarry") {
      const before = yieldBefore(pulses, limitRaisedAtMs, QUARRY_STONE_PER_PULSE, QUARRY_UPGRADE_STONE_PER_PULSE, quarryUpgradeAtMs);
      const total = yieldBefore(pulses, Number.POSITIVE_INFINITY, QUARRY_STONE_PER_PULSE, QUARRY_UPGRADE_STONE_PER_PULSE, quarryUpgradeAtMs);
      produced.stoneBefore += before;
      produced.stoneAfter += total - before;
    } else {
      const amount = building.production.amountPerPulse;
      const before = pulsesBefore(pulses, limitRaisedAtMs) * amount;
      const total = completedPulses * amount;
      if (building.production.resource === "wood") {
        produced.woodBefore += before;
        produced.woodAfter += total - before;
      } else {
        produced.stoneBefore += before;
        produced.stoneAfter += total - before;
      }
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
  const producedWood = produced.woodBefore + produced.woodAfter;
  const producedStone = produced.stoneBefore + produced.stoneAfter;
  const nextState: GameState = {
    ...state,
    resources:
      producedWood === 0 && producedStone === 0
        ? state.resources
        : {
            wood: addClamped(
              addClamped(state.resources.wood, produced.woodBefore, limitsBefore.wood),
              produced.woodAfter,
              limitsAfter.wood,
            ),
            stone: addClamped(
              addClamped(state.resources.stone, produced.stoneBefore, limitsBefore.stone),
              produced.stoneAfter,
              limitsAfter.stone,
            ),
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

interface PulseWindow {
  /** Time of the last settled pulse; the new pulses fall at last + k * pulse (k = 1..count). */
  readonly last: number;
  readonly count: number;
}

/** Number of the window's pulses that fall strictly before `timeMs`. */
function pulsesBefore(window: PulseWindow, timeMs: number): number {
  if (timeMs === Number.POSITIVE_INFINITY) return window.count;
  const index = Math.ceil((timeMs - window.last) / WORLD_PULSE_MS) - 1;
  return Math.max(0, Math.min(window.count, index));
}

/** Yield of the pulses before `timeMs`: the base rate before the upgrade time, the upgraded rate from then on. */
function yieldBefore(
  window: PulseWindow,
  timeMs: number,
  baseRate: number,
  upgradedRate: number,
  upgradedAtMs: number,
): number {
  const pulses = pulsesBefore(window, timeMs);
  const basePulses = Math.min(pulses, pulsesBefore(window, upgradedAtMs));
  return basePulses * baseRate + (pulses - basePulses) * upgradedRate;
}

function addClamped(current: number, added: number, limit: number): number {
  return added === 0 ? current : Math.min(limit, current + added);
}
