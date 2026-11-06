import type { ResourceStock } from "./types";

export const GAME_STATE_SCHEMA_VERSION = 7 as const;

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
