import {
  LUMBER_CAMP_WOOD_PER_PULSE,
  LUMBER_UPGRADE_WOOD_PER_PULSE,
  QUARRY_STONE_PER_PULSE,
  QUARRY_UPGRADE_STONE_PER_PULSE,
} from "./constants";
import type {
  Building,
  GameState,
  ProducingBuilding,
  ProductionUpgrade,
  ProductionUpgradeType,
  VillageBuilding,
} from "./types";

/** True for buildings that stand at the village (survey tent, workshop, storehouse, upgrades). */
export function isVillageBuilding(building: Building): building is VillageBuilding {
  return (
    building.type === "survey-tent" ||
    building.type === "workshop" ||
    building.type === "storehouse" ||
    building.type === "lumber-upgrade" ||
    building.type === "quarry-upgrade"
  );
}

/** True for buildings that produce every world pulse (lumber camp, quarry, module buildings). */
export function isProducingBuilding(building: Building): building is ProducingBuilding {
  return building.type === "lumber-camp" || building.type === "quarry" || building.type === "module";
}

export function findProductionUpgrade(
  state: GameState,
  type: ProductionUpgradeType,
): ProductionUpgrade | undefined {
  return state.buildings.find(
    (building: Building): building is ProductionUpgrade => building.type === type,
  );
}

export function hasActiveProductionUpgrade(state: GameState, type: ProductionUpgradeType): boolean {
  return findProductionUpgrade(state, type)?.status === "active";
}

/** The yield one producing building delivers per pulse right now (with finished upgrades). */
export function yieldPerPulse(
  state: GameState,
  building: ProducingBuilding,
): { readonly resource: "wood" | "stone"; readonly amount: number } {
  if (building.type === "lumber-camp") {
    return {
      resource: "wood",
      amount: hasActiveProductionUpgrade(state, "lumber-upgrade")
        ? LUMBER_UPGRADE_WOOD_PER_PULSE
        : LUMBER_CAMP_WOOD_PER_PULSE,
    };
  }
  if (building.type === "quarry") {
    return {
      resource: "stone",
      amount: hasActiveProductionUpgrade(state, "quarry-upgrade")
        ? QUARRY_UPGRADE_STONE_PER_PULSE
        : QUARRY_STONE_PER_PULSE,
    };
  }
  return { resource: building.production.resource, amount: building.production.amountPerPulse };
}
