import type { WorldSnapshot } from "@mergeforge/domain";
import { Application, Container, Graphics } from "pixi.js";

import { axialKey, axialToPixel, hexCorners, type PixelPoint } from "./hex.js";

const HEX_SIZE = 42;
const MIN_SCALE = 0.45;
const MAX_SCALE = 2.2;
const EDGE_GUARD = 84;

interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface MountedHexWorld {
  destroy(): void;
}

const terrainColors: Readonly<Record<string, { face: number; edge: number }>> = {
  grass: { face: 0x769a5d, edge: 0xa3bf7e },
  meadow: { face: 0x86aa68, edge: 0xb1cb88 },
  plains: { face: 0x8caa65, edge: 0xb8ca83 },
  forest: { face: 0x4f7952, edge: 0x719966 },
  hills: { face: 0x8c8a73, edge: 0xb3ad8d },
  stone: { face: 0x7c8586, edge: 0xa6ada9 },
  mountain: { face: 0x737c80, edge: 0xa0a8a8 },
  water: { face: 0x3e7188, edge: 0x68a1b2 },
  sand: { face: 0xc2a46a, edge: 0xd8c083 },
};

function polygonPoints(points: readonly PixelPoint[]): number[] {
  return points.flatMap(({ x, y }) => [x, y]);
}

function deterministicOffset(q: number, r: number, salt: number): number {
  const mixed = Math.imul(q + salt * 17, 73_856_093) ^ Math.imul(r - salt * 11, 19_349_663);
  return ((mixed >>> 0) % 1_000) / 1_000;
}

function drawTileFace(
  target: Container,
  terrain: string,
  visible: boolean,
  q: number,
  r: number,
): void {
  const corners = polygonPoints(hexCorners({ x: 0, y: 0 }, HEX_SIZE));

  if (!visible) {
    const fog = new Graphics()
      .poly(corners)
      .fill({ color: 0x1a2431, alpha: 0.98 })
      .stroke({ color: 0x344254, width: 1.3, alpha: 0.92 });
    const haze = new Graphics()
      .arc(-8, 2, 16, Math.PI * 0.85, Math.PI * 1.85)
      .stroke({ color: 0x536174, width: 2, alpha: 0.22 })
      .arc(11, -7, 12, Math.PI * 0.1, Math.PI * 1.05)
      .stroke({ color: 0x738196, width: 1.4, alpha: 0.16 });
    target.addChild(fog, haze);
    return;
  }

  const colors = terrainColors[terrain] ?? terrainColors.grass;
  if (colors === undefined) {
    return;
  }

  const face = new Graphics()
    .poly(corners)
    .fill({ color: colors.face })
    .stroke({ color: colors.edge, width: 1.4, alpha: 0.86 });
  const highlight = new Graphics()
    .moveTo(-HEX_SIZE * 0.72, -HEX_SIZE * 0.48)
    .lineTo(0, -HEX_SIZE)
    .lineTo(HEX_SIZE * 0.72, -HEX_SIZE * 0.48)
    .stroke({ color: 0xffffff, width: 1.2, alpha: 0.12 });
  target.addChild(face, highlight);

  drawTerrainDecoration(target, terrain, q, r);
}

function drawTerrainDecoration(target: Container, terrain: string, q: number, r: number): void {
  const ox = (deterministicOffset(q, r, 1) - 0.5) * 18;
  const oy = (deterministicOffset(q, r, 2) - 0.5) * 13;

  if (terrain === "forest") {
    for (let index = 0; index < 3; index += 1) {
      const x = ox + (index - 1) * 13;
      const y = oy + Math.abs(index - 1) * 5;
      const tree = new Graphics()
        .rect(x - 1.8, y + 7, 3.6, 8)
        .fill({ color: 0x4c3526 })
        .poly([x, y - 14, x - 10, y + 7, x + 10, y + 7])
        .fill({ color: index === 1 ? 0x214f3b : 0x2b6143 })
        .poly([x, y - 6, x - 8, y + 11, x + 8, y + 11])
        .fill({ color: 0x356e48 });
      target.addChild(tree);
    }
    return;
  }

  if (terrain === "stone" || terrain === "mountain" || terrain === "hills") {
    const rock = new Graphics()
      .poly([ox - 15, oy + 11, ox - 7, oy - 12, ox + 3, oy - 2, ox + 11, oy - 15, ox + 17, oy + 11])
      .fill({ color: 0x596267 })
      .poly([ox - 7, oy - 12, ox + 3, oy - 2, ox - 1, oy + 11, ox - 15, oy + 11])
      .fill({ color: 0x727d80 })
      .poly([ox + 11, oy - 15, ox + 17, oy + 11, ox + 2, oy + 11])
      .fill({ color: 0x495359 });
    target.addChild(rock);
    return;
  }

  if (terrain === "water") {
    const waves = new Graphics();
    for (let index = -1; index <= 1; index += 1) {
      waves
        .moveTo(ox - 13, oy + index * 9)
        .bezierCurveTo(ox - 6, oy - 4 + index * 9, ox + 3, oy + 4 + index * 9, ox + 13, oy + index * 9)
        .stroke({ color: 0xa7d2d8, width: 1.5, alpha: 0.55 });
    }
    target.addChild(waves);
    return;
  }

  const grass = new Graphics()
    .moveTo(ox - 6, oy + 8)
    .lineTo(ox - 9, oy - 1)
    .moveTo(ox - 6, oy + 8)
    .lineTo(ox - 3, oy - 4)
    .moveTo(ox + 8, oy + 4)
    .lineTo(ox + 5, oy - 3)
    .moveTo(ox + 8, oy + 4)
    .lineTo(ox + 11, oy - 2)
    .stroke({ color: 0x365c38, width: 1.7, alpha: 0.62 });
  target.addChild(grass);
}

function drawVillage(target: Container, coord: { readonly q: number; readonly r: number }): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const village = new Container();
  village.position.set(center.x, center.y - 3);

  const shadow = new Graphics().ellipse(1, 12, 29, 12).fill({ color: 0x07100b, alpha: 0.38 });
  const platform = new Graphics()
    .ellipse(0, 8, 27, 13)
    .fill({ color: 0x6e5638 })
    .stroke({ color: 0xc29a5c, width: 1.2, alpha: 0.7 });
  const hall = new Graphics()
    .roundRect(-13, -8, 26, 22, 3)
    .fill({ color: 0xe7d29d })
    .stroke({ color: 0x6b4931, width: 1.3 })
    .poly([-17, -7, 0, -22, 17, -7])
    .fill({ color: 0x2e6b69 })
    .stroke({ color: 0x173e42, width: 1.3 })
    .rect(-3, 3, 6, 11)
    .fill({ color: 0x4d3428 });
  const chimney = new Graphics()
    .rect(8, -18, 4, 9)
    .fill({ color: 0x785e4b })
    .circle(11, -23, 4)
    .fill({ color: 0xd9e3dc, alpha: 0.27 });
  village.addChild(shadow, platform, chimney, hall);
  target.addChild(village);
}

function worldBounds(world: WorldSnapshot): WorldBounds {
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

function renderWorld(world: WorldSnapshot): { layer: Container; bounds: WorldBounds } {
  const layer = new Container();
  const visible = new Set(world.visibleTileKeys);
  const orderedTiles = [...world.tiles].sort((left, right) => {
    const leftPoint = axialToPixel(left.coord, HEX_SIZE);
    const rightPoint = axialToPixel(right.coord, HEX_SIZE);
    return leftPoint.y - rightPoint.y || leftPoint.x - rightPoint.x;
  });

  for (const tile of orderedTiles) {
    const point = axialToPixel(tile.coord, HEX_SIZE);
    const tileLayer = new Container();
    // Elevation belongs inside the tile artwork. Moving a complete face would
    // separate it from neighbors and break the shared-edge hex grid.
    tileLayer.position.set(point.x, point.y);
    drawTileFace(tileLayer, String(tile.terrain), visible.has(axialKey(tile.coord)), tile.coord.q, tile.coord.r);
    layer.addChild(tileLayer);
  }

  if (visible.has(axialKey(world.village.coord))) {
    drawVillage(layer, world.village.coord);
  }

  return { layer, bounds: worldBounds(world) };
}

/** Mounts a self-contained Pixi hexworld view into the supplied element. */
export async function mountHexWorld(
  container: HTMLElement,
  world: WorldSnapshot,
): Promise<MountedHexWorld> {
  const initialRect = container.getBoundingClientRect();
  const app = new Application();
  await app.init({
    width: Math.max(1, Math.round(initialRect.width)),
    height: Math.max(1, Math.round(initialRect.height)),
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: 0x101923,
    backgroundAlpha: 1,
    preference: "webgl",
  });

  const previousTouchAction = container.style.touchAction;
  const previousOverflow = container.style.overflow;
  container.style.touchAction = "none";
  container.style.overflow = "hidden";
  app.canvas.style.display = "block";
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  container.appendChild(app.canvas);

  const { layer, bounds } = renderWorld(world);
  app.stage.addChild(layer);

  let viewportWidth = Math.max(1, initialRect.width);
  let viewportHeight = Math.max(1, initialRect.height);
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const fitScale = Math.min(
    1.1,
    Math.max(MIN_SCALE, Math.min((viewportWidth - 48) / contentWidth, (viewportHeight - 48) / contentHeight)),
  );
  layer.scale.set(fitScale);
  layer.position.set(
    viewportWidth / 2 - ((bounds.minX + bounds.maxX) / 2) * fitScale,
    viewportHeight / 2 - ((bounds.minY + bounds.maxY) / 2) * fitScale,
  );

  const clampView = (): void => {
    const scale = layer.scale.x;
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;

    if (scaledWidth <= viewportWidth - EDGE_GUARD * 2) {
      layer.position.x = viewportWidth / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
    } else {
      const minX = viewportWidth - EDGE_GUARD - bounds.maxX * scale;
      const maxX = EDGE_GUARD - bounds.minX * scale;
      layer.position.x = Math.min(maxX, Math.max(minX, layer.position.x));
    }

    if (scaledHeight <= viewportHeight - EDGE_GUARD * 2) {
      layer.position.y = viewportHeight / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;
    } else {
      const minY = viewportHeight - EDGE_GUARD - bounds.maxY * scale;
      const maxY = EDGE_GUARD - bounds.minY * scale;
      layer.position.y = Math.min(maxY, Math.max(minY, layer.position.y));
    }
  };
  clampView();

  let activePointer: number | undefined;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointer !== undefined) {
      return;
    }
    activePointer = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
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
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    clampView();
    event.preventDefault();
  };

  const finishPointer = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) {
      return;
    }
    if (app.canvas.hasPointerCapture(event.pointerId)) {
      app.canvas.releasePointerCapture(event.pointerId);
    }
    activePointer = undefined;
    app.canvas.style.cursor = "grab";
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = app.canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const previousScale = layer.scale.x;
    const factor = Math.exp(-event.deltaY * 0.0012);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, previousScale * factor));
    const worldX = (pointerX - layer.position.x) / previousScale;
    const worldY = (pointerY - layer.position.y) / previousScale;
    layer.scale.set(nextScale);
    layer.position.set(pointerX - worldX * nextScale, pointerY - worldY * nextScale);
    clampView();
  };

  app.canvas.style.cursor = "grab";
  app.canvas.addEventListener("pointerdown", onPointerDown);
  app.canvas.addEventListener("pointermove", onPointerMove);
  app.canvas.addEventListener("pointerup", finishPointer);
  app.canvas.addEventListener("pointercancel", finishPointer);
  app.canvas.addEventListener("wheel", onWheel, { passive: false });

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry === undefined) {
      return;
    }
    const nextWidth = Math.max(1, entry.contentRect.width);
    const nextHeight = Math.max(1, entry.contentRect.height);
    const worldCenterX = (viewportWidth / 2 - layer.position.x) / layer.scale.x;
    const worldCenterY = (viewportHeight / 2 - layer.position.y) / layer.scale.y;
    viewportWidth = nextWidth;
    viewportHeight = nextHeight;
    app.renderer.resize(Math.round(nextWidth), Math.round(nextHeight));
    layer.position.set(
      nextWidth / 2 - worldCenterX * layer.scale.x,
      nextHeight / 2 - worldCenterY * layer.scale.y,
    );
    clampView();
  });
  resizeObserver.observe(container);

  let destroyed = false;
  return {
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      resizeObserver.disconnect();
      app.canvas.removeEventListener("pointerdown", onPointerDown);
      app.canvas.removeEventListener("pointermove", onPointerMove);
      app.canvas.removeEventListener("pointerup", finishPointer);
      app.canvas.removeEventListener("pointercancel", finishPointer);
      app.canvas.removeEventListener("wheel", onWheel);
      container.style.touchAction = previousTouchAction;
      container.style.overflow = previousOverflow;
      app.destroy(true, { children: true });
    },
  };
}
