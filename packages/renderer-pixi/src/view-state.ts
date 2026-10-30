export interface HexWorldViewState {
  readonly selectedTileKey?: string | null;
  readonly roadTileKeys?: readonly string[];
  readonly roadPreviewTileKeys?: readonly string[];
}

export interface NormalizedViewState {
  readonly selectedTileKey: string | null;
  readonly roadTileKeys: readonly string[];
  readonly roadPreviewTileKeys: readonly string[];
}

export function initialViewState(options: HexWorldViewState | undefined): NormalizedViewState {
  return {
    selectedTileKey: options?.selectedTileKey ?? null,
    roadTileKeys: options?.roadTileKeys ?? [],
    roadPreviewTileKeys: options?.roadPreviewTileKeys ?? [],
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
  };
}
