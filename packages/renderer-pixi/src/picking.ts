import type { WorldSnapshot } from "@mergeforge/domain";
import type { Container } from "pixi.js";

import type { Viewport } from "./camera.js";
import { axialKey, pixelToAxial } from "./hex.js";
import { HEX_SIZE } from "./theme.js";
import type { HexSelectionEvent } from "./types.js";

/**
 * Resolves a client (page) position to the hex underneath it.
 * Returns null when no tile of the world exists there.
 */
export function pickHexAt(
  canvas: HTMLCanvasElement,
  layer: Container,
  viewport: Viewport,
  world: WorldSnapshot,
  clientX: number,
  clientY: number,
): HexSelectionEvent | null {
  const rect = canvas.getBoundingClientRect();
  const screenX = ((clientX - rect.left) / Math.max(1, rect.width)) * viewport.width;
  const screenY = ((clientY - rect.top) / Math.max(1, rect.height)) * viewport.height;
  const coord = pixelToAxial(
    {
      x: (screenX - layer.position.x) / layer.scale.x,
      y: (screenY - layer.position.y) / layer.scale.y,
    },
    HEX_SIZE,
  );
  const key = axialKey(coord);
  // Fogged tiles stay selectable: the pathfinder survey targets exactly those.
  const tileExists = world.tiles.some((tile) => axialKey(tile.coord) === key);
  if (!tileExists) {
    return null;
  }
  return { key, coord };
}
