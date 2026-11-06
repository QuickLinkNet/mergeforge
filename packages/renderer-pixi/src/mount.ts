import type { WorldSnapshot } from "@mergeforge/domain";
import { Container } from "pixi.js";

import {
  centerLayerOn,
  clampLayer,
  fitLayer,
  focusPoint,
  startScale,
  viewCenterInWorld,
  zoomLayerAt,
  type Viewport,
} from "./camera.js";
import { pickHexAt } from "./picking.js";
import { renderWorld } from "./render-world.js";
import { createHexWorldScene } from "./scene.js";
import { DRAG_THRESHOLD } from "./theme.js";
import type { HexWorldMountOptions, MountedHexWorld } from "./types.js";
import { initialViewState, patchViewState, type HexWorldViewState } from "./view-state.js";

/** Mounts a self-contained Pixi hexworld view into the supplied element. */
export async function mountHexWorld(
  container: HTMLElement,
  world: WorldSnapshot,
  options?: HexWorldMountOptions,
): Promise<MountedHexWorld> {
  const scene = await createHexWorldScene(container);
  const { app, initialRect } = scene;

  let currentWorld = world;
  let viewState = initialViewState(options);
  let renderedWorld = renderWorld(currentWorld, viewState);
  const layer = new Container();
  layer.addChild(renderedWorld.layer);
  app.stage.addChild(layer);

  let viewport: Viewport = {
    width: Math.max(1, initialRect.width),
    height: Math.max(1, initialRect.height),
  };
  let bounds = renderedWorld.bounds;
  fitLayer(layer, viewport, bounds, startScale(viewport, bounds));

  const clampView = (): void => clampLayer(layer, viewport, bounds);
  clampView();

  const refreshScene = (): void => {
    const worldCenter = viewCenterInWorld(layer, viewport);
    const previousScene = renderedWorld.layer;
    renderedWorld = renderWorld(currentWorld, viewState);
    bounds = renderedWorld.bounds;
    layer.removeChild(previousScene);
    previousScene.destroy({ children: true });
    layer.addChild(renderedWorld.layer);
    centerLayerOn(layer, viewport, worldCenter);
    clampView();
  };

  let activePointer: number | undefined;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerDragged = false;

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointer !== undefined) {
      return;
    }
    activePointer = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerDragged = false;
    app.canvas.setPointerCapture(event.pointerId);
    app.canvas.style.cursor = "grabbing";
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) {
      return;
    }
    layer.position.x += event.clientX - lastPointerX;
    layer.position.y += event.clientY - lastPointerY;
    if (!pointerDragged && Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > DRAG_THRESHOLD) {
      pointerDragged = true;
      options?.onMapDrag?.();
    }
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    clampView();
    event.preventDefault();
  };

  const selectHexAt = (clientX: number, clientY: number): void => {
    const selection = pickHexAt(app.canvas, layer, viewport, currentWorld, clientX, clientY);
    if (selection === null) {
      return;
    }
    viewState = { ...viewState, selectedTileKey: selection.key };
    refreshScene();
    options?.onHexSelect?.(selection);
  };

  const finishPointer = (event: PointerEvent, select: boolean): void => {
    if (event.pointerId !== activePointer) {
      return;
    }
    if (app.canvas.hasPointerCapture(event.pointerId)) {
      app.canvas.releasePointerCapture(event.pointerId);
    }
    activePointer = undefined;
    app.canvas.style.cursor = "grab";
    if (select && !pointerDragged) {
      selectHexAt(event.clientX, event.clientY);
    }
  };

  const onPointerUp = (event: PointerEvent): void => finishPointer(event, true);
  const onPointerCancel = (event: PointerEvent): void => finishPointer(event, false);

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = app.canvas.getBoundingClientRect();
    zoomLayerAt(layer, event.clientX - rect.left, event.clientY - rect.top, event.deltaY);
    clampView();
  };

  app.canvas.style.cursor = "grab";
  app.canvas.addEventListener("pointerdown", onPointerDown);
  app.canvas.addEventListener("pointermove", onPointerMove);
  app.canvas.addEventListener("pointerup", onPointerUp);
  app.canvas.addEventListener("pointercancel", onPointerCancel);
  app.canvas.addEventListener("wheel", onWheel, { passive: false });

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry === undefined) {
      return;
    }
    const nextWidth = Math.max(1, entry.contentRect.width);
    const nextHeight = Math.max(1, entry.contentRect.height);
    const worldCenter = viewCenterInWorld(layer, viewport);
    viewport = { width: nextWidth, height: nextHeight };
    app.renderer.resize(Math.round(nextWidth), Math.round(nextHeight));
    centerLayerOn(layer, viewport, worldCenter);
    clampView();
  });
  resizeObserver.observe(container);

  let destroyed = false;
  return {
    update(nextWorld: WorldSnapshot, nextViewState?: HexWorldViewState): void {
      if (destroyed) {
        return;
      }
      currentWorld = nextWorld;
      viewState = patchViewState(viewState, nextViewState);
      refreshScene();
    },
    focusOn(tileKeys: readonly string[]): void {
      const point = destroyed ? null : focusPoint(currentWorld, tileKeys);
      if (point === null) {
        return;
      }
      centerLayerOn(layer, viewport, point);
      clampView();
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      resizeObserver.disconnect();
      app.canvas.removeEventListener("pointerdown", onPointerDown);
      app.canvas.removeEventListener("pointermove", onPointerMove);
      app.canvas.removeEventListener("pointerup", onPointerUp);
      app.canvas.removeEventListener("pointercancel", onPointerCancel);
      app.canvas.removeEventListener("wheel", onWheel);
      scene.restoreContainerStyle();
      app.destroy(true, { children: true });
    },
  };
}
