import {
  STONE_STORAGE_BY_LEVEL,
  STOREHOUSE_MAX_LEVEL,
  WOOD_STORAGE_BY_LEVEL,
} from "./constants";
import type { Building, GameState, ResourceStock, Storehouse } from "./types";

/** Storehouse level whose limits apply right now (0 = no storehouse finished yet). */
export type EffectiveStorehouseLevel = 0 | 1 | 2 | 3;

export function findStorehouse(state: GameState): Storehouse | undefined {
  return state.buildings.find(
    (building: Building): building is Storehouse => building.type === "storehouse",
  );
}

/**
 * The level that counts for the storage limits: a storehouse under
 * construction still has the limits of the level before.
 */
export function storehouseLevel(state: GameState): EffectiveStorehouseLevel {
  const storehouse = findStorehouse(state);
  if (storehouse === undefined) return 0;
  return (storehouse.status === "active" ? storehouse.level : storehouse.level - 1) as EffectiveStorehouseLevel;
}

/** Storage limits of a storehouse level (0 = the village's base storage). */
export function storageLimitsAtLevel(level: number): ResourceStock {
  const index = Math.max(0, Math.min(STOREHOUSE_MAX_LEVEL, Math.floor(level)));
  return {
    wood: WOOD_STORAGE_BY_LEVEL[index] ?? WOOD_STORAGE_BY_LEVEL[0] ?? 0,
    stone: STONE_STORAGE_BY_LEVEL[index] ?? STONE_STORAGE_BY_LEVEL[0] ?? 0,
  };
}

/** The storage limits of this game right now, derived from the finished storehouse level. */
export function storageLimits(state: GameState): ResourceStock {
  return storageLimitsAtLevel(storehouseLevel(state));
}

/** The largest storage the game can ever reach (storehouse at its highest level). */
export const MAX_STORAGE_LIMITS: ResourceStock = storageLimitsAtLevel(STOREHOUSE_MAX_LEVEL);
