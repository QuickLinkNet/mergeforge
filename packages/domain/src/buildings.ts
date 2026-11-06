import {
  LUMBER_CAMP_BUILD_MS,
  LUMBER_CAMP_STONE_COST,
  LUMBER_CAMP_WOOD_COST,
  QUARRY_BUILD_MS,
  QUARRY_STONE_COST,
  QUARRY_WOOD_COST,
  SURVEY_TENT_BUILD_MS,
  SURVEY_TENT_STONE_COST,
  SURVEY_TENT_WOOD_COST,
} from "./constants";
import { hexKey } from "./hex";
import { assertTime, hasOccupiedBuildSlot } from "./internal";
import type { ModuleManifest } from "./modules";
import { advanceTime } from "./time";
import type {
  GameState,
  HexCoord,
  LumberCamp,
  ModuleBuilding,
  Quarry,
  StartLumberCampRejection,
  StartLumberCampResult,
  StartModuleBuildingRejection,
  StartModuleBuildingResult,
  StartQuarryRejection,
  StartQuarryResult,
  StartSurveyTentRejection,
  StartSurveyTentResult,
  SurveyTent,
} from "./types";

/**
 * Starts a lumber camp after first settling elapsed construction and production
 * at the explicit command time. The caller should keep the returned state even
 * for a rejected command because time may have advanced.
 */
export function startLumberCamp(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): StartLumberCampResult {
  const settledState = advanceTime(state, nowMs);
  const targetKey = hexKey(target);
  const targetTile = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === targetKey,
  );

  if (targetTile === undefined) {
    return lumberCampRejected(settledState, "tile-not-found");
  }
  if (targetTile.terrain !== "forest") {
    return lumberCampRejected(settledState, "not-forest");
  }
  if (!settledState.roadTileKeys.includes(targetKey)) {
    return lumberCampRejected(settledState, "road-required");
  }
  if (settledState.buildings.some((building) => building.tileKey === targetKey)) {
    return lumberCampRejected(settledState, "already-built");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return lumberCampRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < LUMBER_CAMP_WOOD_COST ||
    settledState.resources.stone < LUMBER_CAMP_STONE_COST
  ) {
    return lumberCampRejected(settledState, "insufficient-resources");
  }

  const completesAtMs = nowMs + LUMBER_CAMP_BUILD_MS;
  assertTime(completesAtMs);
  const lumberCamp: LumberCamp = {
    id: `lumber-camp:${targetKey}`,
    type: "lumber-camp",
    tileKey: targetKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
    lastProductionAtMs: nowMs,
  };

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - LUMBER_CAMP_WOOD_COST,
        stone: settledState.resources.stone - LUMBER_CAMP_STONE_COST,
      },
      buildings: [...settledState.buildings, lumberCamp],
    },
  };
}

/**
 * Starts a building defined by a module manifest. The rules (terrain, road,
 * cost, build time, production) come only from the manifest; the core knows
 * nothing about individual modules.
 */
export function startModuleBuilding(
  state: GameState,
  manifest: ModuleManifest,
  target: HexCoord,
  nowMs: number,
): StartModuleBuildingResult {
  const settledState = advanceTime(state, nowMs);
  const reject = (reason: StartModuleBuildingRejection): StartModuleBuildingResult => ({
    ok: false,
    reason,
    state: settledState,
  });
  const targetKey = hexKey(target);
  const targetTile = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === targetKey,
  );
  const { building } = manifest;

  if (targetTile === undefined) return reject("tile-not-found");
  if (!building.placement.terrain.includes(targetTile.terrain)) {
    return reject("terrain-not-allowed");
  }
  if (!settledState.visibleTileKeys.includes(targetKey)) return reject("not-visible");
  if (building.placement.requiresRoadConnection && !settledState.roadTileKeys.includes(targetKey)) {
    return reject("road-required");
  }
  if (settledState.buildings.some((entry) => entry.tileKey === targetKey)) {
    return reject("already-built");
  }
  if (
    settledState.modules.some(
      (ref) => ref.id === manifest.id && ref.version !== manifest.version,
    )
  ) {
    return reject("module-version-conflict");
  }
  if (hasOccupiedBuildSlot(settledState)) return reject("build-slot-occupied");
  if (
    settledState.resources.wood < building.cost.wood ||
    settledState.resources.stone < building.cost.stone
  ) {
    return reject("insufficient-resources");
  }

  const completesAtMs = nowMs + building.buildTimeMs;
  assertTime(completesAtMs);
  const moduleBuilding: ModuleBuilding = {
    id: `module:${manifest.id}:${targetKey}`,
    type: "module",
    moduleId: manifest.id,
    moduleVersion: manifest.version,
    tileKey: targetKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
    lastProductionAtMs: nowMs,
    production: {
      resource: building.production.resource,
      amountPerPulse: building.production.amountPerPulse,
    },
  };
  const alreadyReferenced = settledState.modules.some((ref) => ref.id === manifest.id);

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - building.cost.wood,
        stone: settledState.resources.stone - building.cost.stone,
      },
      buildings: [...settledState.buildings, moduleBuilding],
      modules: alreadyReferenced
        ? settledState.modules
        : [...settledState.modules, { id: manifest.id, version: manifest.version }],
    },
  };
}

/** Starts a quarry on a connected, data-driven stone resource site. */
export function startQuarry(
  state: GameState,
  target: HexCoord,
  nowMs: number,
): StartQuarryResult {
  const settledState = advanceTime(state, nowMs);
  const targetKey = hexKey(target);
  const targetTile = settledState.world.tiles.find(
    (tile) => hexKey(tile.coord) === targetKey,
  );

  if (targetTile === undefined) return quarryRejected(settledState, "tile-not-found");
  if (
    !settledState.world.resourceSites.some(
      (site) => site.type === "stone" && site.tileKey === targetKey,
    )
  ) {
    return quarryRejected(settledState, "not-stone-site");
  }
  if (!settledState.roadTileKeys.includes(targetKey)) {
    return quarryRejected(settledState, "road-required");
  }
  if (settledState.buildings.some((building) => building.tileKey === targetKey)) {
    return quarryRejected(settledState, "already-built");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return quarryRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < QUARRY_WOOD_COST ||
    settledState.resources.stone < QUARRY_STONE_COST
  ) {
    return quarryRejected(settledState, "insufficient-resources");
  }

  const completesAtMs = nowMs + QUARRY_BUILD_MS;
  assertTime(completesAtMs);
  const quarry: Quarry = {
    id: `quarry:${targetKey}`,
    type: "quarry",
    tileKey: targetKey,
    status: "constructing",
    startedAtMs: nowMs,
    completesAtMs,
    lastProductionAtMs: nowMs,
  };

  return {
    ok: true,
    state: {
      ...settledState,
      resources: {
        wood: settledState.resources.wood - QUARRY_WOOD_COST,
        stone: settledState.resources.stone - QUARRY_STONE_COST,
      },
      buildings: [...settledState.buildings, quarry],
    },
  };
}

/** Builds the village survey tent, permanently expanding charge storage to 12. */
export function startSurveyTent(
  state: GameState,
  nowMs: number,
): StartSurveyTentResult {
  const settledState = advanceTime(state, nowMs);
  if (settledState.buildings.some((building) => building.type === "survey-tent")) {
    return surveyTentRejected(settledState, "already-built");
  }
  if (
    !settledState.units.some(
      (unit) => unit.type === "pathfinder" && unit.status === "active",
    )
  ) {
    return surveyTentRejected(settledState, "pathfinder-required");
  }
  if (hasOccupiedBuildSlot(settledState)) {
    return surveyTentRejected(settledState, "build-slot-occupied");
  }
  if (
    settledState.resources.wood < SURVEY_TENT_WOOD_COST ||
    settledState.resources.stone < SURVEY_TENT_STONE_COST
  ) {
    return surveyTentRejected(settledState, "insufficient-resources");
  }

  const tileKey = hexKey(settledState.world.village.coord);
  const completesAtMs = nowMs + SURVEY_TENT_BUILD_MS;
  assertTime(completesAtMs);
  const surveyTent: SurveyTent = {
    id: `survey-tent:${tileKey}`,
    type: "survey-tent",
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
        wood: settledState.resources.wood - SURVEY_TENT_WOOD_COST,
        stone: settledState.resources.stone - SURVEY_TENT_STONE_COST,
      },
      buildings: [...settledState.buildings, surveyTent],
    },
  };
}

function lumberCampRejected(
  state: GameState,
  reason: StartLumberCampRejection,
): StartLumberCampResult {
  return { ok: false, reason, state };
}

function quarryRejected(
  state: GameState,
  reason: StartQuarryRejection,
): StartQuarryResult {
  return { ok: false, reason, state };
}

function surveyTentRejected(
  state: GameState,
  reason: StartSurveyTentRejection,
): StartSurveyTentResult {
  return { ok: false, reason, state };
}
