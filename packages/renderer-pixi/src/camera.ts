import type { WorldSnapshot } from "@mergeforge/domain";
import type { Container } from "pixi.js";

import { axialToPixel } from "./hex.js";
import {
  EDGE_GUARD,
  FIT_PADDING,
  HEX_SIZE,
  MAX_SCALE,
  MIN_SCALE,
  START_SCALE_MAX,
  START_SCALE_MIN,
  WHEEL_ZOOM_SPEED,
} from "./theme.js";
import type { WorldBounds } from "./types.js";

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export function worldBounds(world: WorldSnapshot): WorldBounds {
  if (world.tiles.length === 0) {
    return { minX: -HEX_SIZE, minY: -HEX_SIZE, maxX: HEX_SIZE, maxY: HEX_SIZE };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const tile of world.tiles) {
    const point = axialToPixel(tile.coord, HEX_SIZE);
    minX = Math.min(minX, point.x - HEX_SIZE);
    maxX = Math.max(maxX, point.x + HEX_SIZE);
    minY = Math.min(minY, point.y - HEX_SIZE - 30);
    maxY = Math.max(maxY, point.y + HEX_SIZE + 20);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Start readable: the whole (mostly fogged) world is far larger than the screen, so fitting it
 * would shrink the village to a speck. Players can still zoom out to the minimum scale.
 */
export function startScale(viewport: Viewport, bounds: WorldBounds): number {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  return Math.max(
    START_SCALE_MIN,
    Math.min(
      START_SCALE_MAX,
      Math.max(
        MIN_SCALE,
        Math.min((viewport.width - FIT_PADDING) / contentWidth, (viewport.height - FIT_PADDING) / contentHeight),
      ),
    ),
  );
}

/** Scales the layer and centers the world bounds in the viewport. */
export function fitLayer(layer: Container, viewport: Viewport, bounds: WorldBounds, scale: number): void {
  layer.scale.set(scale);
  layer.position.set(
    viewport.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    viewport.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  );
}

/** Keeps the world on screen: centers small content, otherwise limits panning to EDGE_GUARD. */
export function clampLayer(layer: Container, viewport: Viewport, bounds: WorldBounds): void {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const scale = layer.scale.x;
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;

  if (scaledWidth <= viewport.width - EDGE_GUARD * 2) {
    layer.position.x = viewport.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
  } else {
    const minX = viewport.width - EDGE_GUARD - bounds.maxX * scale;
    const maxX = EDGE_GUARD - bounds.minX * scale;
    layer.position.x = Math.min(maxX, Math.max(minX, layer.position.x));
  }

  if (scaledHeight <= viewport.height - EDGE_GUARD * 2) {
    layer.position.y = viewport.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;
  } else {
    const minY = viewport.height - EDGE_GUARD - bounds.maxY * scale;
    const maxY = EDGE_GUARD - bounds.minY * scale;
    layer.position.y = Math.min(maxY, Math.max(minY, layer.position.y));
  }
}

/** World coordinate currently shown at the viewport center. */
export function viewCenterInWorld(layer: Container, viewport: Viewport): WorldPoint {
  return {
    x: (viewport.width / 2 - layer.position.x) / layer.scale.x,
    y: (viewport.height / 2 - layer.position.y) / layer.scale.y,
  };
}

/** Moves the layer so that the given world point sits at the viewport center. */
export function centerLayerOn(layer: Container, viewport: Viewport, worldCenter: WorldPoint): void {
  layer.position.set(
    viewport.width / 2 - worldCenter.x * layer.scale.x,
    viewport.height / 2 - worldCenter.y * layer.scale.y,
  );
}

/** Wheel zoom around the pointer position (canvas-local pixels), clamped to MIN/MAX_SCALE. */
export function zoomLayerAt(layer: Container, pointerX: number, pointerY: number, deltaY: number): void {
  const previousScale = layer.scale.x;
  const factor = Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
  const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, previousScale * factor));
  const worldX = (pointerX - layer.position.x) / previousScale;
  const worldY = (pointerY - layer.position.y) / previousScale;
  layer.scale.set(nextScale);
  layer.position.set(pointerX - worldX * nextScale, pointerY - worldY * nextScale);
}
