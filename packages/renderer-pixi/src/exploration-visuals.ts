import type { WayfinderVisual } from "./view-state.js";

export interface FilteredExplorationVisuals {
  readonly wayfinder: WayfinderVisual | null;
  readonly surveyTargetTileKey: string | null;
}

/**
 * Filters renderability only. A survey target may intentionally sit in fog;
 * adjacency and expedition validity remain domain responsibilities.
 */
export function filterExplorationVisuals(
  wayfinder: WayfinderVisual | null,
  surveyTargetTileKey: string | null,
  visibleTileKeys: readonly string[],
  worldTileKeys: readonly string[],
): FilteredExplorationVisuals {
  const visible = new Set(visibleTileKeys);
  const inWorld = new Set(worldTileKeys);
  return {
    wayfinder:
      wayfinder !== null && visible.has(wayfinder.tileKey) && inWorld.has(wayfinder.tileKey)
        ? wayfinder
        : null,
    surveyTargetTileKey:
      surveyTargetTileKey !== null && inWorld.has(surveyTargetTileKey)
        ? surveyTargetTileKey
        : null,
  };
}
