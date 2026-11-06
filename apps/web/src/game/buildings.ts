import {
  LUMBER_CAMP_STONE_COST,
  LUMBER_CAMP_WOOD_COST,
  LUMBER_CAMP_WOOD_PER_PULSE,
  QUARRY_STONE_COST,
  QUARRY_STONE_PER_PULSE,
  QUARRY_WOOD_COST,
  yieldPerPulse,
  type GameState,
  type ProducingBuilding,
  type StartLumberCampResult,
  type StartQuarryResult,
} from '@mergeforge/domain';
import type { LoadedModule } from '../moduleRegistry';

/** Buildings with their own map tile and production (not the village buildings). */
export type ProductionBuilding = ProducingBuilding;

export type BuildingPlan =
  | {
      readonly type: 'lumber-camp';
      readonly name: string;
      readonly icon: string;
      readonly result: StartLumberCampResult;
      readonly woodCost: number;
      readonly stoneCost: number;
      readonly output: string;
      readonly action: string;
    }
  | {
      readonly type: 'quarry';
      readonly name: string;
      readonly icon: string;
      readonly result: StartQuarryResult;
      readonly woodCost: number;
      readonly stoneCost: number;
      readonly output: string;
      readonly action: string;
    };

/** The core building that can be planned on the selected tile, if any. */
export function planBuilding(
  lumberCampPreview: StartLumberCampResult | null,
  quarryPreview: StartQuarryResult | null,
): BuildingPlan | null {
  return lumberCampPreview !== null
    ? {
        type: 'lumber-camp' as const,
        name: 'Holzfällerlager',
        icon: '♜',
        result: lumberCampPreview,
        woodCost: LUMBER_CAMP_WOOD_COST,
        stoneCost: LUMBER_CAMP_STONE_COST,
        output: `+${LUMBER_CAMP_WOOD_PER_PULSE} Holz / Takt`,
        action: 'Lager errichten',
      }
    : quarryPreview !== null
      ? {
          type: 'quarry' as const,
          name: 'Steinbruch',
          icon: '◆',
          result: quarryPreview,
          woodCost: QUARRY_WOOD_COST,
          stoneCost: QUARRY_STONE_COST,
          output: `+${QUARRY_STONE_PER_PULSE} Stein / Takt`,
          action: 'Steinbruch errichten',
        }
      : null;
}

export interface BuildingDescription {
  readonly name: string;
  /** German article with trailing space ("das ", "der ") or empty for module names. */
  readonly article: string;
  readonly resource: string;
  readonly yieldPerPulse: number;
}

/**
 * Name, article and yield of a production building for its status card. With a game
 * state the yield includes finished production upgrades; without one it is the base yield.
 */
export function describeBuilding(
  building: ProductionBuilding,
  modules: readonly LoadedModule[],
  state?: GameState,
): BuildingDescription {
  if (building.type === 'module') {
    return {
      name: modules.find((entry) => entry.manifest.id === building.moduleId)?.manifest.name ?? building.moduleId,
      article: '',
      resource: building.production.resource === 'stone' ? 'Stein' : 'Holz',
      yieldPerPulse: building.production.amountPerPulse,
    };
  }
  const quarry = building.type === 'quarry';
  return {
    name: quarry ? 'Steinbruch' : 'Holzfällerlager',
    article: quarry ? 'der ' : 'das ',
    resource: quarry ? 'Stein' : 'Holz',
    yieldPerPulse:
      state === undefined
        ? quarry ? QUARRY_STONE_PER_PULSE : LUMBER_CAMP_WOOD_PER_PULSE
        : yieldPerPulse(state, building).amount,
  };
}
