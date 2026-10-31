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

export interface HexWorldViewState {
  readonly selectedTileKey?: string | null;
  readonly roadTileKeys?: readonly string[];
  readonly roadPreviewTileKeys?: readonly string[];
  readonly buildings?: readonly BuildingVisual[];
  readonly findEffects?: readonly FindEffectVisual[];
}

export interface NormalizedViewState {
  readonly selectedTileKey: string | null;
  readonly roadTileKeys: readonly string[];
  readonly roadPreviewTileKeys: readonly string[];
  readonly buildings: readonly BuildingVisual[];
  readonly findEffects: readonly FindEffectVisual[];
}

export function initialViewState(options: HexWorldViewState | undefined): NormalizedViewState {
  return {
    selectedTileKey: options?.selectedTileKey ?? null,
    roadTileKeys: options?.roadTileKeys ?? [],
    roadPreviewTileKeys: options?.roadPreviewTileKeys ?? [],
    buildings: options?.buildings ?? [],
    findEffects: options?.findEffects ?? [],
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
  };
}
