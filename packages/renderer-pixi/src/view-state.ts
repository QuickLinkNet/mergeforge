export type LumberCampVisualState = "construction" | "complete";

export interface LumberCampVisual {
  readonly tileKey: string;
  readonly state: LumberCampVisualState;
}

export interface HexWorldViewState {
  readonly selectedTileKey?: string | null;
  readonly roadTileKeys?: readonly string[];
  readonly roadPreviewTileKeys?: readonly string[];
  readonly lumberCamps?: readonly LumberCampVisual[];
  readonly woodFindTileKeys?: readonly string[];
}

export interface NormalizedViewState {
  readonly selectedTileKey: string | null;
  readonly roadTileKeys: readonly string[];
  readonly roadPreviewTileKeys: readonly string[];
  readonly lumberCamps: readonly LumberCampVisual[];
  readonly woodFindTileKeys: readonly string[];
}

export function initialViewState(options: HexWorldViewState | undefined): NormalizedViewState {
  return {
    selectedTileKey: options?.selectedTileKey ?? null,
    roadTileKeys: options?.roadTileKeys ?? [],
    roadPreviewTileKeys: options?.roadPreviewTileKeys ?? [],
    lumberCamps: options?.lumberCamps ?? [],
    woodFindTileKeys: options?.woodFindTileKeys ?? [],
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
    lumberCamps: patch.lumberCamps ?? current.lumberCamps,
    woodFindTileKeys: patch.woodFindTileKeys ?? current.woodFindTileKeys,
  };
}
