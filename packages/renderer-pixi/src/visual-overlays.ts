import type { BuildingVisual, FindEffectVisual } from "./view-state.js";

export interface VisibleVisualOverlays {
  readonly buildings: readonly BuildingVisual[];
  readonly findEffects: readonly FindEffectVisual[];
}

/**
 * Keeps overlays on renderable, discovered tiles and deduplicates transient
 * input without making any gameplay validity decision.
 */
export function filterVisibleVisualOverlays(
  buildings: readonly BuildingVisual[],
  findEffects: readonly FindEffectVisual[],
  visibleTileKeys: readonly string[],
  worldTileKeys: readonly string[],
): VisibleVisualOverlays {
  const visible = new Set(visibleTileKeys);
  const inWorld = new Set(worldTileKeys);
  const buildingsByTile = new Map<string, BuildingVisual>();
  for (const building of buildings) {
    if (visible.has(building.tileKey) && inWorld.has(building.tileKey)) {
      buildingsByTile.set(building.tileKey, building);
    }
  }

  const effectsByIdentity = new Map<string, FindEffectVisual>();
  for (const effect of findEffects) {
    if (visible.has(effect.tileKey) && inWorld.has(effect.tileKey)) {
      effectsByIdentity.set(`${effect.tileKey}:${effect.resource}`, effect);
    }
  }

  return {
    buildings: [...buildingsByTile.values()],
    findEffects: [...effectsByIdentity.values()],
  };
}
