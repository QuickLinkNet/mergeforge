import { STOREHOUSE_LEVELS, STOREHOUSE_MAX_LEVEL } from "./constants";
import { hexKey } from "./hex";
import { assertTime, hasOccupiedBuildSlot } from "./internal";
import { hasCompletedChapter } from "./state";
import { findStorehouse } from "./storage";
import { advanceTime } from "./time";
import type {
  GameState,
  StartStorehouseRejection,
  StartStorehouseResult,
  Storehouse,
  StorehouseLevel,
} from "./types";

/** Cost and build time of a storehouse level (1..3). */
export function storehouseLevelSpec(level: StorehouseLevel): {
  readonly wood: number;
  readonly stone: number;
  readonly buildMs: number;
} {
  const spec = STOREHOUSE_LEVELS[level - 1];
  if (spec === undefined) throw new RangeError(`Unknown storehouse level ${level}.`);
  return spec;
}

/**
 * The level the next storehouse order would build, or null when the highest
 * level is finished or a level is still under construction.
 */
export function nextStorehouseLevel(state: GameState): StorehouseLevel | null {
  const storehouse = findStorehouse(state);
  if (storehouse === undefined) return 1;
  if (storehouse.status !== "active" || storehouse.level >= STOREHOUSE_MAX_LEVEL) return null;
  return (storehouse.level + 1) as StorehouseLevel;
}

/**
 * Builds the village storehouse (level 1) or upgrades it to the next level.
 * The storage limits rise only once the construction is finished.
 */
export function startStorehouse(state: GameState, nowMs: number): StartStorehouseResult {
  const settledState = advanceTime(state, nowMs);
  const reject = (reason: StartStorehouseRejection): StartStorehouseResult => ({
    ok: false,
    reason,
    state: settledState,
  });
  if (!hasCompletedChapter(settledState, 7)) return reject("locked");
  const current = findStorehouse(settledState);
  if (current?.status === "active" && current.level >= STOREHOUSE_MAX_LEVEL) return reject("max-level");
  if (hasOccupiedBuildSlot(settledState)) return reject("build-slot-occupied");
  const level = nextStorehouseLevel(settledState);
  if (level === null) return reject("build-slot-occupied");
  const spec = storehouseLevelSpec(level);
  if (settledState.resources.wood < spec.wood || settledState.resources.stone < spec.stone) {
    return reject("insufficient-resources");
  }

  const tileKey = hexKey(settledState.world.village.coord);
  const completesAtMs = nowMs + spec.buildMs;
  assertTime(completesAtMs);
  const storehouse: Storehouse = {
    id: `storehouse:${tileKey}`,
    type: "storehouse",
    tileKey,
    status: "constructing",
    level,
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
      buildings:
        current === undefined
          ? [...settledState.buildings, storehouse]
          : settledState.buildings.map((building) => (building === current ? storehouse : building)),
    },
  };
}
