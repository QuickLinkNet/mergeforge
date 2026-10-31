import type { RelaySite, ResourceSite, WorldSnapshot } from "@mergeforge/domain";

export type StoneResourceSiteVisual = ResourceSite;

export type RelaySiteVisual = RelaySite;

/** Exact structural subset of the pending M2 WorldSnapshot site contract. */
export type WorldSiteVisualSource = Pick<WorldSnapshot, "resourceSites" | "relaySite">;

export interface VisibleWorldSites {
  readonly stoneSites: readonly StoneResourceSiteVisual[];
  readonly relaySite: RelaySiteVisual | null;
}

/** Filters discovery-driven visuals only; it does not decide ownership or build validity. */
export function visibleWorldSites(
  source: WorldSiteVisualSource,
  visibleTileKeys: readonly string[],
): VisibleWorldSites {
  const visible = new Set(visibleTileKeys);
  return {
    stoneSites: source.resourceSites.filter(
      (site) => site.type === "stone" && visible.has(site.tileKey),
    ),
    relaySite:
      visible.has(source.relaySite.tileKey)
        ? source.relaySite
        : null,
  };
}
