import {
  isVillageBuilding,
  type Building,
  type GameState,
  type ProducingBuilding,
  type WorldSnapshot,
} from '@mergeforge/domain';
import type {
  FindEffectVisual,
  HexSelectionEvent,
  HexWorldViewState,
} from '@mergeforge/renderer-pixi';
import type { PathfinderGuidance } from './pathfinderGuidance';

/** The renderer only knows a world snapshot; fog follows the live game state. */
export function worldForRenderer(state: GameState): WorldSnapshot {
  return { ...state.world, visibleTileKeys: state.visibleTileKeys };
}

/** Map buildings: tent, workshop, storehouse and upgrades live in the village and have no own map sprite. */
export function rendererBuildings(buildings: readonly Building[]): NonNullable<HexWorldViewState['buildings']> {
  return buildings
    .filter((building): building is ProducingBuilding => !isVillageBuilding(building))
    .map((building) => ({
      tileKey: building.tileKey,
      type: building.type,
      state: building.status === 'constructing' ? 'construction' : 'complete',
    }));
}

export function rendererSurveyTent(surveyTent: Building | undefined): NonNullable<HexWorldViewState['surveyTent']> | null {
  return surveyTent === undefined
    ? null
    : { state: surveyTent.status === 'constructing' ? 'construction' : 'complete' };
}

export interface RendererViewInput {
  readonly selectedTile: HexSelectionEvent | null;
  readonly roadTileKeys: readonly string[] | undefined;
  readonly buildings: readonly Building[] | undefined;
  readonly placementKeys: readonly string[];
  readonly roadPreviewOk: boolean;
  readonly surveyPreviewOk: boolean;
  readonly guidance: PathfinderGuidance | null;
  readonly findEffects: readonly FindEffectVisual[];
  readonly pathfinder: GameState['units'][number] | undefined;
  readonly surveyTent: Building | undefined;
  readonly relayDiscovered: boolean;
}

/** Everything the map draws on top of the terrain for the current selection. */
export function buildRendererView(input: RendererViewInput): HexWorldViewState {
  const { selectedTile, guidance, pathfinder } = input;
  return {
    selectedTileKey: selectedTile?.key ?? null,
    roadTileKeys: input.roadTileKeys ?? [],
    roadPreviewTileKeys:
      input.placementKeys.length > 0
        ? input.placementKeys
        : selectedTile !== null && input.roadPreviewOk
          ? [selectedTile.key]
          : selectedTile === null && guidance !== null ? guidance.highlightKeys : [],
    buildings: input.buildings === undefined ? [] : rendererBuildings(input.buildings),
    findEffects: input.findEffects,
    wayfinder: pathfinder === undefined
      ? null
      : {
          tileKey: pathfinder.tileKey,
          state: pathfinder.status,
        },
    surveyTargetTileKey: input.surveyPreviewOk ? selectedTile?.key ?? null : null,
    surveyTent: rendererSurveyTent(input.surveyTent),
    relayDiscoveryHighlight: input.relayDiscovered,
  };
}
