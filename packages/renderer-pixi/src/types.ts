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
}

export interface MountedHexWorld {
  update(world: WorldSnapshot, viewState?: HexWorldViewState): void;
  destroy(): void;
}
