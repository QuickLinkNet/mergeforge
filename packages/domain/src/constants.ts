import type { ResourceStock } from "./types";

export const GAME_STATE_SCHEMA_VERSION = 8 as const;

export const STARTING_RESOURCES: ResourceStock = {
  wood: 12,
  stone: 6,
};

export const MAX_WOOD_STORAGE = 300;
export const MAX_STONE_STORAGE = 150;
export const ROAD_WOOD_COST = 1;
export const FOREST_SURFACE_WOOD = 1;
export const STONE_SURFACE_FIND_TOTAL = 4;
export const WORLD_PULSE_MS = 10 * 60 * 1_000;
export const LUMBER_CAMP_BUILD_MS = WORLD_PULSE_MS;
export const LUMBER_CAMP_WOOD_COST = 4;
export const LUMBER_CAMP_STONE_COST = 1;
export const LUMBER_CAMP_WOOD_PER_PULSE = 2;
export const QUARRY_BUILD_MS = WORLD_PULSE_MS;
export const QUARRY_WOOD_COST = 3;
export const QUARRY_STONE_COST = 1;
export const QUARRY_STONE_PER_PULSE = 1;
export const PATHFINDER_TRAINING_MS = WORLD_PULSE_MS;
export const PATHFINDER_WOOD_COST = 2;
export const PATHFINDER_STONE_COST = 2;
export const PATHFINDER_BASE_MAX_CHARGES = 6;
export const PATHFINDER_CHARGES_PER_PULSE = 1;
export const SURVEY_TENT_BUILD_MS = WORLD_PULSE_MS;
export const SURVEY_TENT_WOOD_COST = 3;
export const SURVEY_TENT_STONE_COST = 1;
export const PATHFINDER_EXPANDED_MAX_CHARGES = 12;
export const WORKSHOP_BUILD_MS = 2 * WORLD_PULSE_MS;
export const WORKSHOP_WOOD_COST = 6;
export const WORKSHOP_STONE_COST = 4;
export const RELAY_REPAIR_MS = 3 * WORLD_PULSE_MS;
export const RELAY_REPAIR_WOOD_COST = 5;
export const RELAY_REPAIR_STONE_COST = 6;

// Phase B: resource sinks after the prologue (D-023).
/** Highest storehouse level. */
export const STOREHOUSE_MAX_LEVEL = 3;
/** Cost and build time of each storehouse level; index 0 is level 1. */
export const STOREHOUSE_LEVELS: readonly {
  readonly wood: number;
  readonly stone: number;
  readonly buildMs: number;
}[] = [
  { wood: 60, stone: 30, buildMs: 3 * WORLD_PULSE_MS },
  { wood: 120, stone: 60, buildMs: 6 * WORLD_PULSE_MS },
  { wood: 200, stone: 100, buildMs: 9 * WORLD_PULSE_MS },
];
/** Wood storage limit by storehouse level (index = level 0..3). Level 0 equals MAX_WOOD_STORAGE. */
export const WOOD_STORAGE_BY_LEVEL: readonly number[] = [MAX_WOOD_STORAGE, 450, 600, 800];
/** Stone storage limit by storehouse level (index = level 0..3). Level 0 equals MAX_STONE_STORAGE. */
export const STONE_STORAGE_BY_LEVEL: readonly number[] = [MAX_STONE_STORAGE, 225, 300, 400];
export const LUMBER_UPGRADE_WOOD_COST = 50;
export const LUMBER_UPGRADE_STONE_COST = 20;
export const LUMBER_UPGRADE_BUILD_MS = 2 * WORLD_PULSE_MS;
export const LUMBER_UPGRADE_WOOD_PER_PULSE = 4;
export const QUARRY_UPGRADE_WOOD_COST = 40;
export const QUARRY_UPGRADE_STONE_COST = 30;
export const QUARRY_UPGRADE_BUILD_MS = 3 * WORLD_PULSE_MS;
export const QUARRY_UPGRADE_STONE_PER_PULSE = 2;
