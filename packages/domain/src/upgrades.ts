import {
  LUMBER_UPGRADE_BUILD_MS,
  LUMBER_UPGRADE_STONE_COST,
  LUMBER_UPGRADE_WOOD_COST,
  QUARRY_UPGRADE_BUILD_MS,
  QUARRY_UPGRADE_STONE_COST,
  QUARRY_UPGRADE_WOOD_COST,
} from "./constants";
import { hexKey } from "./hex";
import { assertTime, hasOccupiedBuildSlot } from "./internal";
import { findProductionUpgrade } from "./production";
import { hasCompletedChapter } from "./state";
import { advanceTime } from "./time";
import type {
  GameState,
  ProductionUpgrade,
  ProductionUpgradeType,
  StartProductionUpgradeRejection,
  StartProductionUpgradeResult,
} from "./types";

/** Cost, build time and the producing building each upgrade needs. */
export const PRODUCTION_UPGRADES: Readonly<
  Record<
    ProductionUpgradeType,
    {
      readonly producer: "lumber-camp" | "quarry";
      readonly wood: number;
      readonly stone: number;
      readonly buildMs: number;
    }
  >
> = {
  "lumber-upgrade": {
    producer: "lumber-camp",
    wood: LUMBER_UPGRADE_WOOD_COST,
    stone: LUMBER_UPGRADE_STONE_COST,
    buildMs: LUMBER_UPGRADE_BUILD_MS,
  },
  "quarry-upgrade": {
    producer: "quarry",
    wood: QUARRY_UPGRADE_WOOD_COST,
    stone: QUARRY_UPGRADE_STONE_COST,
    buildMs: QUARRY_UPGRADE_BUILD_MS,
  },
};

/**
 * Starts a one-time production upgrade at the village. It needs a finished
 * chapter 7 and an active lumber camp (or quarry); once it is finished every
 * such building yields the upgraded amount per pulse.
 */
export function startProductionUpgrade(
  state: GameState,
  type: ProductionUpgradeType,
  nowMs: number,
): StartProductionUpgradeResult {
  const settledState = advanceTime(state, nowMs);
  const reject = (reason: StartProductionUpgradeRejection): StartProductionUpgradeResult => ({
    ok: false,
    reason,
    state: settledState,
  });
  const spec = PRODUCTION_UPGRADES[type];
  if (!hasCompletedChapter(settledState, 7)) return reject("locked");
  if (findProductionUpgrade(settledState, type) !== undefined) return reject("already-built");
  if (
    !settledState.buildings.some(
      (building) => building.type === spec.producer && building.status === "active",
    )
  ) {
    return reject("producer-required");
  }
  if (hasOccupiedBuildSlot(settledState)) return reject("build-slot-occupied");
  if (settledState.resources.wood < spec.wood || settledState.resources.stone < spec.stone) {
    return reject("insufficient-resources");
  }

  const tileKey = hexKey(settledState.world.village.coord);
  const completesAtMs = nowMs + spec.buildMs;
  assertTime(completesAtMs);
  const upgrade: ProductionUpgrade = {
    id: `${type}:${tileKey}`,
    type,
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
        wood: settledState.resources.wood - spec.wood,
        stone: settledState.resources.stone - spec.stone,
      },
      buildings: [...settledState.buildings, upgrade],
    },
  };
}

/** Lumber camp upgrade: 2 -> 4 wood per pulse. */
export function startLumberUpgrade(state: GameState, nowMs: number): StartProductionUpgradeResult {
  return startProductionUpgrade(state, "lumber-upgrade", nowMs);
}

/** Quarry upgrade: 1 -> 2 stone per pulse. */
export function startQuarryUpgrade(state: GameState, nowMs: number): StartProductionUpgradeResult {
  return startProductionUpgrade(state, "quarry-upgrade", nowMs);
}
