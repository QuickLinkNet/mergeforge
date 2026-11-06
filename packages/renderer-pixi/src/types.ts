import type { HexCoord, WorldSnapshot } from "@mergeforge/domain";

import type { HexWorldViewState } from "./view-state.js";

export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface HexSelectionEvent {
  readonly key: string;
  readonly coord: HexCoord;
}

export interface HexWorldMountOptions extends HexWorldViewState {
  readonly onHexSelect?: (event: HexSelectionEvent) => void;
  /** Called once when the player starts dragging the map. */
  readonly onMapDrag?: () => void;
}

export interface MountedHexWorld {
  update(world: WorldSnapshot, viewState?: HexWorldViewState): void;
  /** Scrolls the map so the given tiles are centered (no-op when none is part of the world). */
  focusOn(tileKeys: readonly string[]): void;
  destroy(): void;
}
