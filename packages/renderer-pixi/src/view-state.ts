export type BuildingVisualType = "lumber-camp" | "quarry";
export type BuildingVisualState = "construction" | "complete";

export interface BuildingVisual {
  readonly tileKey: string;
  readonly type: BuildingVisualType;
  readonly state: BuildingVisualState;
}

export type FindEffectResource = "wood" | "stone";

export interface FindEffectVisual {
  readonly tileKey: string;
  readonly resource: FindEffectResource;
}

export type WayfinderVisualState = "training" | "active";

export interface WayfinderVisual {
  readonly tileKey: string;
  readonly state: WayfinderVisualState;
}

export type SurveyTentVisualState = "construction" | "complete";

export interface SurveyTentVisual {
  readonly state: SurveyTentVisualState;
}

export interface HexWorldViewState {
  readonly selectedTileKey?: string | null;
  readonly roadTileKeys?: readonly string[];
  readonly roadPreviewTileKeys?: readonly string[];
  readonly buildings?: readonly BuildingVisual[];
  readonly findEffects?: readonly FindEffectVisual[];
  readonly wayfinder?: WayfinderVisual | null;
  readonly surveyTargetTileKey?: string | null;
  readonly surveyTent?: SurveyTentVisual | null;
}

export interface NormalizedViewState {
  readonly selectedTileKey: string | null;
  readonly roadTileKeys: readonly string[];
  readonly roadPreviewTileKeys: readonly string[];
  readonly buildings: readonly BuildingVisual[];
  readonly findEffects: readonly FindEffectVisual[];
  readonly wayfinder: WayfinderVisual | null;
  readonly surveyTargetTileKey: string | null;
  readonly surveyTent: SurveyTentVisual | null;
}

export function initialViewState(options: HexWorldViewState | undefined): NormalizedViewState {
  return {
    selectedTileKey: options?.selectedTileKey ?? null,
    roadTileKeys: options?.roadTileKeys ?? [],
    roadPreviewTileKeys: options?.roadPreviewTileKeys ?? [],
    buildings: options?.buildings ?? [],
    findEffects: options?.findEffects ?? [],
    wayfinder: options?.wayfinder ?? null,
    surveyTargetTileKey: options?.surveyTargetTileKey ?? null,
    surveyTent: options?.surveyTent ?? null,
  };
}

/** Applies only supplied fields so callers can update one overlay independently. */
export function patchViewState(
  current: NormalizedViewState,
  patch: HexWorldViewState | undefined,
): NormalizedViewState {
  if (patch === undefined) {
    return current;
  }
  return {
    selectedTileKey:
      patch.selectedTileKey === undefined ? current.selectedTileKey : patch.selectedTileKey,
    roadTileKeys: patch.roadTileKeys ?? current.roadTileKeys,
    roadPreviewTileKeys: patch.roadPreviewTileKeys ?? current.roadPreviewTileKeys,
    buildings: patch.buildings ?? current.buildings,
    findEffects: patch.findEffects ?? current.findEffects,
    wayfinder: patch.wayfinder === undefined ? current.wayfinder : patch.wayfinder,
    surveyTargetTileKey:
      patch.surveyTargetTileKey === undefined
        ? current.surveyTargetTileKey
        : patch.surveyTargetTileKey,
    surveyTent: patch.surveyTent === undefined ? current.surveyTent : patch.surveyTent,
  };
}
