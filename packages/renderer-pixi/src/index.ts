import type { HexCoord, WorldSnapshot } from "@mergeforge/domain";
import { Application, Container, Graphics } from "pixi.js";

import { axialKey, axialToPixel, hexCorners, pixelToAxial, type PixelPoint } from "./hex.js";
import { visibleWorldSites } from "./site-visuals.js";
import {
  initialViewState,
  patchViewState,
  type BuildingVisual,
  type BuildingVisualState,
  type BuildingVisualType,
  type FindEffectResource,
  type FindEffectVisual,
  type HexWorldViewState,
  type NormalizedViewState,
} from "./view-state.js";
import { filterVisibleVisualOverlays } from "./visual-overlays.js";

export type {
  BuildingVisual,
  BuildingVisualState,
  BuildingVisualType,
  FindEffectResource,
  FindEffectVisual,
  HexWorldViewState,
} from "./view-state.js";

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

function drawStoneSource(target: Container, coord: HexCoord): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const site = new Container();
  site.position.set(center.x, center.y + 4);

  const shadow = new Graphics().ellipse(0, 11, 31, 12).fill({ color: 0x0a0d0e, alpha: 0.38 });
  const groundMark = new Graphics()
    .ellipse(0, 8, 28, 12)
    .fill({ color: 0x596165, alpha: 0.55 })
    .stroke({ color: 0xd8ba73, width: 1.6, alpha: 0.72 });
  const rocks = new Graphics()
    .poly([-20, 9, -14, -7, -5, -13, 2, 1, 6, 11])
    .fill({ color: 0x7c8788 })
    .stroke({ color: 0x424d51, width: 1.2 })
    .poly([-5, 10, 2, -12, 12, -16, 20, 8])
    .fill({ color: 0x626d72 })
    .stroke({ color: 0x3e494e, width: 1.2 })
    .poly([2, -12, 12, -16, 8, -5])
    .fill({ color: 0xaab1ae, alpha: 0.62 });
  const marker = new Graphics()
    .rect(20, -20, 3, 30)
    .fill({ color: 0x6a4326 })
    .poly([21.5, -25, 28, -18, 21.5, -11, 15, -18])
    .fill({ color: 0xe2b753 })
    .stroke({ color: 0x6b4a27, width: 1.2 });
  site.addChild(shadow, groundMark, rocks, marker);
  target.addChild(site);
}

function drawRelayRuin(target: Container, coord: HexCoord): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const relay = new Container();
  relay.position.set(center.x, center.y + 2);

  const shadow = new Graphics().ellipse(0, 13, 34, 14).fill({ color: 0x060a0e, alpha: 0.48 });
  const plinth = new Graphics()
    .ellipse(0, 8, 31, 14)
    .fill({ color: 0x4c555b })
    .stroke({ color: 0x8f9a9b, width: 2, alpha: 0.72 })
    .ellipse(0, 5, 19, 8)
    .stroke({ color: 0x242d33, width: 2, alpha: 0.9 })
    .moveTo(-8, 2)
    .lineTo(-2, 8)
    .lineTo(4, 3)
    .lineTo(11, 9)
    .stroke({ color: 0x20282d, width: 1.5 });
  const brokenPillars = new Graphics()
    .poly([-22, 8, -19, -17, -12, -22, -8, 8])
    .fill({ color: 0x707b80 })
    .stroke({ color: 0x343e44, width: 1.2 })
    .poly([11, 8, 13, -10, 19, -14, 23, 8])
    .fill({ color: 0x59656b })
    .stroke({ color: 0x313b41, width: 1.2 });
  const mast = new Graphics()
    .moveTo(-2, 5)
    .lineTo(3, -31)
    .stroke({ color: 0x39464d, width: 6 })
    .moveTo(1, -23)
    .lineTo(14, -29)
    .stroke({ color: 0x56646b, width: 3 })
    .arc(3, -27, 16, Math.PI * 0.72, Math.PI * 1.72)
    .stroke({ color: 0x829095, width: 3.2, alpha: 0.82 });
  const dormantCore = new Graphics()
    .circle(0, 3, 7)
    .fill({ color: 0x4ec3cc, alpha: 0.18 })
    .circle(0, 3, 3.5)
    .fill({ color: 0x80e7ea, alpha: 0.62 });
  relay.addChild(shadow, plinth, brokenPillars, mast, dormantCore);
  target.addChild(relay);
}

function drawWorldSiteVisuals(target: Container, world: WorldSnapshot): void {
  const sites = visibleWorldSites(world, world.visibleTileKeys);
  const tileCoordinates = new Map(world.tiles.map((tile) => [axialKey(tile.coord), tile.coord]));

  for (const stoneSite of sites.stoneSites) {
    const coord = tileCoordinates.get(stoneSite.tileKey);
    if (coord !== undefined) {
      drawStoneSource(target, coord);
    }
  }

  if (sites.relaySite !== null) {
    const coord = tileCoordinates.get(sites.relaySite.tileKey);
    if (coord !== undefined) {
      drawRelayRuin(target, coord);
    }
  }
}

function drawWoodFind(target: Container, coord: HexCoord): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const marker = new Container();
  marker.position.set(center.x, center.y + 7);

  const glow = new Graphics().circle(0, 0, 19).fill({ color: 0xf0c46a, alpha: 0.12 });
  const logs = new Graphics();
  for (let index = -1; index <= 1; index += 1) {
    const y = index * 6;
    logs
      .roundRect(-14, y - 3, 28, 6, 3)
      .fill({ color: index === 0 ? 0x8b5b32 : 0x704526 })
      .stroke({ color: 0x4b2d1b, width: 1 })
      .circle(-12, y, 2.2)
      .fill({ color: 0xd0a05c });
  }
  marker.addChild(glow, logs);
  target.addChild(marker);
}

function drawStoneFind(target: Container, coord: HexCoord): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const marker = new Container();
  marker.position.set(center.x, center.y + 7);

  const glow = new Graphics().circle(0, 0, 20).fill({ color: 0xd9d3a2, alpha: 0.14 });
  const stones = new Graphics()
    .poly([-15, 7, -10, -5, -2, -8, 3, 7])
    .fill({ color: 0x929a97 })
    .stroke({ color: 0x4c5657, width: 1 })
    .poly([-2, 8, 3, -7, 12, -10, 17, 7])
    .fill({ color: 0x737e81 })
    .stroke({ color: 0x424c50, width: 1 })
    .poly([3, -7, 12, -10, 8, -1])
    .fill({ color: 0xb9bfba, alpha: 0.62 });
  const spark = new Graphics()
    .moveTo(0, -14)
    .lineTo(0, -22)
    .moveTo(-11, -10)
    .lineTo(-16, -16)
    .moveTo(12, -9)
    .lineTo(18, -14)
    .stroke({ color: 0xf4dc85, width: 1.8, alpha: 0.82 });
  marker.addChild(glow, stones, spark);
  target.addChild(marker);
}

function drawFindEffect(target: Container, coord: HexCoord, resource: FindEffectResource): void {
  if (resource === "stone") {
    drawStoneFind(target, coord);
    return;
  }
  drawWoodFind(target, coord);
}

function drawLumberCamp(
  target: Container,
  coord: HexCoord,
  state: BuildingVisualState,
): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const camp = new Container();
  camp.position.set(center.x, center.y + 3);

  const shadow = new Graphics().ellipse(0, 13, 33, 13).fill({ color: 0x0a120c, alpha: 0.4 });
  const foundation = new Graphics()
    .ellipse(0, 9, 30, 13)
    .fill({ color: state === "construction" ? 0x806543 : 0x6f5838 })
    .stroke({ color: 0xbe9659, width: 1.2, alpha: 0.78 });
  camp.addChild(shadow, foundation);

  if (state === "construction") {
    const scaffold = new Graphics()
      .rect(-18, -15, 3.5, 27)
      .fill({ color: 0x9a6c3b })
      .rect(14.5, -15, 3.5, 27)
      .fill({ color: 0x9a6c3b })
      .rect(-18, -13, 36, 3.5)
      .fill({ color: 0xba864a })
      .moveTo(-16, 8)
      .lineTo(16, -11)
      .moveTo(-16, -11)
      .lineTo(16, 8)
      .stroke({ color: 0x6d4728, width: 2.2, alpha: 0.95 });
    const tarp = new Graphics()
      .poly([-13, -12, 1, -22, 15, -12, 9, -6, -8, -6])
      .fill({ color: 0xc49a55, alpha: 0.92 })
      .stroke({ color: 0x795b35, width: 1.1 });
    const lumber = new Graphics()
      .roundRect(-11, 5, 22, 5, 2.5)
      .fill({ color: 0x75502e })
      .roundRect(-8, 0, 22, 5, 2.5)
      .fill({ color: 0x95673a });
    camp.addChild(scaffold, tarp, lumber);
    target.addChild(camp);
    return;
  }

  const shed = new Graphics()
    .roundRect(-16, -11, 32, 25, 3)
    .fill({ color: 0xa7743f })
    .stroke({ color: 0x55351f, width: 1.4 })
    .moveTo(-10, -9)
    .lineTo(-10, 13)
    .moveTo(-3, -9)
    .lineTo(-3, 13)
    .moveTo(4, -9)
    .lineTo(4, 13)
    .moveTo(11, -9)
    .lineTo(11, 13)
    .stroke({ color: 0x6e4829, width: 1.2, alpha: 0.72 })
    .poly([-20, -10, 0, -25, 20, -10])
    .fill({ color: 0x315c48 })
    .stroke({ color: 0x173a31, width: 1.5 });
  const doorway = new Graphics().roundRect(-5, 2, 10, 13, 2).fill({ color: 0x3f2b20 });
  const logStack = new Graphics();
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 3 - row; column += 1) {
      const x = 19 + column * 6 - row * 3;
      const y = 10 - row * 6;
      logStack
        .circle(x, y, 3.1)
        .fill({ color: 0xd0a160 })
        .stroke({ color: 0x684326, width: 1 });
    }
  }
  camp.addChild(shed, doorway, logStack);
  target.addChild(camp);
}

function drawQuarry(target: Container, coord: HexCoord, state: BuildingVisualState): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const quarry = new Container();
  quarry.position.set(center.x, center.y + 4);

  const shadow = new Graphics().ellipse(0, 12, 34, 14).fill({ color: 0x090c0e, alpha: 0.46 });
  const rim = new Graphics()
    .ellipse(0, 8, 31, 14)
    .fill({ color: 0x747a72 })
    .stroke({ color: 0xaaa98f, width: 1.4, alpha: 0.74 })
    .ellipse(0, 7, 22, 10)
    .fill({ color: state === "construction" ? 0x4f5552 : 0x30383a });
  quarry.addChild(shadow, rim);

  if (state === "construction") {
    const stakes = new Graphics()
      .rect(-23, -7, 3, 20)
      .fill({ color: 0x8b6138 })
      .rect(20, -7, 3, 20)
      .fill({ color: 0x8b6138 })
      .moveTo(-21, -3)
      .lineTo(21, 9)
      .moveTo(-21, 9)
      .lineTo(21, -3)
      .stroke({ color: 0xd1a14f, width: 1.7, alpha: 0.9 });
    const looseStone = new Graphics()
      .poly([-15, 11, -9, 0, -2, 4, 2, 12])
      .fill({ color: 0x929a98 })
      .poly([7, 11, 11, 1, 19, 5, 21, 12])
      .fill({ color: 0x697477 });
    quarry.addChild(stakes, looseStone);
    target.addChild(quarry);
    return;
  }

  const cutFaces = new Graphics()
    .poly([-21, 4, -12, -5, -5, 2, -8, 11])
    .fill({ color: 0x687276 })
    .poly([-7, 10, -3, -2, 7, -6, 11, 9])
    .fill({ color: 0x535f64 })
    .poly([10, 9, 14, -1, 22, 4, 24, 11])
    .fill({ color: 0x7c8583 });
  const hoist = new Graphics()
    .moveTo(-17, 7)
    .lineTo(-10, -22)
    .lineTo(0, -28)
    .lineTo(11, -21)
    .lineTo(18, 7)
    .moveTo(-10, -22)
    .lineTo(11, -21)
    .stroke({ color: 0x6b472b, width: 4 })
    .moveTo(1, -24)
    .lineTo(1, 1)
    .stroke({ color: 0x2e3333, width: 1.7 })
    .roundRect(-5, 0, 12, 8, 2)
    .fill({ color: 0x9a7550 })
    .stroke({ color: 0x4d3929, width: 1 });
  const blocks = new Graphics()
    .rect(18, 4, 10, 8)
    .fill({ color: 0xa3a9a3 })
    .stroke({ color: 0x565f60, width: 1 })
    .rect(23, -4, 10, 8)
    .fill({ color: 0x858e8b })
    .stroke({ color: 0x4e5859, width: 1 });
  quarry.addChild(cutFaces, hoist, blocks);
  target.addChild(quarry);
}

function drawDataDrivenVisuals(
  target: Container,
  world: WorldSnapshot,
  buildings: readonly BuildingVisual[],
  findEffects: readonly FindEffectVisual[],
): void {
  const tileCoordinates = new Map(world.tiles.map((tile) => [axialKey(tile.coord), tile.coord]));
  const overlays = filterVisibleVisualOverlays(
    buildings,
    findEffects,
    world.visibleTileKeys,
    [...tileCoordinates.keys()],
  );

  for (const effect of overlays.findEffects) {
    const coord = tileCoordinates.get(effect.tileKey);
    if (coord !== undefined) {
      drawFindEffect(target, coord, effect.resource);
    }
  }

  for (const building of overlays.buildings) {
    const coord = tileCoordinates.get(building.tileKey);
    if (coord !== undefined) {
      if (building.type === "quarry") {
        drawQuarry(target, coord, building.state);
      } else {
        drawLumberCamp(target, coord, building.state);
      }
    }
  }
}

function areNeighbors(left: HexCoord, right: HexCoord): boolean {
  const dq = left.q - right.q;
  const dr = left.r - right.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 1;
}

function drawableCoordinates(world: WorldSnapshot, keys: readonly string[]): Map<string, HexCoord> {
  const requested = new Set(keys);
  const visible = new Set(world.visibleTileKeys);
  const result = new Map<string, HexCoord>();
  for (const tile of world.tiles) {
    const key = axialKey(tile.coord);
    if (requested.has(key) && visible.has(key)) {
      result.set(key, tile.coord);
    }
  }
  return result;
}

function addRoadSegment(graphics: Graphics, from: HexCoord, to: HexCoord): void {
  const start = axialToPixel(from, HEX_SIZE);
  const end = axialToPixel(to, HEX_SIZE);
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y);
}

function drawRoadNetwork(
  target: Container,
  coordinates: ReadonlyMap<string, HexCoord>,
  villageCoord: HexCoord,
  preview: boolean,
  connectedCoordinates: ReadonlyMap<string, HexCoord> = coordinates,
): void {
  if (coordinates.size === 0) {
    return;
  }

  const underlay = new Graphics();
  const road = new Graphics();
  const highlight = new Graphics();
  for (const [key, coord] of coordinates) {
    for (const [otherKey, otherCoord] of connectedCoordinates) {
      if (!areNeighbors(coord, otherCoord)) {
        continue;
      }
      const otherIsPreview = coordinates.has(otherKey);
      if (otherIsPreview && key.localeCompare(otherKey) >= 0) {
        continue;
      }
      addRoadSegment(underlay, coord, otherCoord);
      addRoadSegment(road, coord, otherCoord);
      addRoadSegment(highlight, coord, otherCoord);
    }
    if (areNeighbors(coord, villageCoord)) {
      addRoadSegment(underlay, coord, villageCoord);
      addRoadSegment(road, coord, villageCoord);
      addRoadSegment(highlight, coord, villageCoord);
    }
  }

  const alpha = preview ? 0.72 : 1;
  underlay.stroke({ color: preview ? 0x254953 : 0x3c2b20, width: 13, alpha: alpha * 0.9 });
  road.stroke({ color: preview ? 0x58c4c7 : 0xb68b55, width: 8, alpha });
  highlight.stroke({ color: preview ? 0xb9ffff : 0xe5c68b, width: 2, alpha: alpha * 0.8 });
  target.addChild(underlay, road, highlight);

  const nodes = new Graphics();
  for (const coord of coordinates.values()) {
    const point = axialToPixel(coord, HEX_SIZE);
    nodes
      .circle(point.x, point.y, preview ? 7 : 8)
      .fill({ color: preview ? 0x62d1cf : 0xb9905b, alpha })
      .stroke({ color: preview ? 0xd5ffff : 0x5a3d27, width: 2, alpha });
  }
  target.addChild(nodes);
}

function drawInteractionOverlay(
  target: Container,
  world: WorldSnapshot,
  viewState: NormalizedViewState,
): void {
  const visible = new Set(world.visibleTileKeys);
  if (viewState.selectedTileKey !== null && visible.has(viewState.selectedTileKey)) {
    const tile = world.tiles.find((candidate) => axialKey(candidate.coord) === viewState.selectedTileKey);
    if (tile !== undefined) {
      const center = axialToPixel(tile.coord, HEX_SIZE);
      const selection = new Graphics()
        .poly(polygonPoints(hexCorners(center, HEX_SIZE - 3)))
        .fill({ color: 0xf8cf69, alpha: 0.12 })
        .stroke({ color: 0xffdc78, width: 3.2, alpha: 0.98 });
      target.addChild(selection);
    }
  }

  const previewCoordinates = drawableCoordinates(world, viewState.roadPreviewTileKeys);
  if (previewCoordinates.size > 0) {
    const outlines = new Graphics();
    for (const coord of previewCoordinates.values()) {
      const center = axialToPixel(coord, HEX_SIZE);
      outlines
        .poly(polygonPoints(hexCorners(center, HEX_SIZE - 7)))
        .fill({ color: 0x75e4dd, alpha: 0.08 })
        .stroke({ color: 0x9ff4ec, width: 2, alpha: 0.75 });
    }
    target.addChild(outlines);
  }
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

function renderWorld(world: WorldSnapshot, viewState: NormalizedViewState): { layer: Container; bounds: WorldBounds } {
  const layer = new Container();
  const terrainLayer = new Container();
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
    terrainLayer.addChild(tileLayer);
  }

  const roadLayer = new Container();
  const roadCoordinates = drawableCoordinates(world, viewState.roadTileKeys);
  drawRoadNetwork(roadLayer, roadCoordinates, world.village.coord, false);
  const previewCoordinates = drawableCoordinates(world, viewState.roadPreviewTileKeys);
  const allConnectedCoordinates = new Map([...roadCoordinates, ...previewCoordinates]);
  drawRoadNetwork(roadLayer, previewCoordinates, world.village.coord, true, allConnectedCoordinates);

  const landmarkLayer = new Container();
  drawWorldSiteVisuals(landmarkLayer, world);
  drawDataDrivenVisuals(
    landmarkLayer,
    world,
    viewState.buildings,
    viewState.findEffects,
  );
  if (visible.has(axialKey(world.village.coord))) {
    drawVillage(landmarkLayer, world.village.coord);
  }

  const interactionLayer = new Container();
  drawInteractionOverlay(interactionLayer, world, viewState);
  layer.addChild(terrainLayer, roadLayer, landmarkLayer, interactionLayer);

  return { layer, bounds: worldBounds(world) };
}

/** Mounts a self-contained Pixi hexworld view into the supplied element. */
export async function mountHexWorld(
  container: HTMLElement,
  world: WorldSnapshot,
  options?: HexWorldMountOptions,
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

  let currentWorld = world;
  let viewState = initialViewState(options);
  let renderedWorld = renderWorld(currentWorld, viewState);
  const layer = new Container();
  layer.addChild(renderedWorld.layer);
  app.stage.addChild(layer);

  let viewportWidth = Math.max(1, initialRect.width);
  let viewportHeight = Math.max(1, initialRect.height);
  let bounds = renderedWorld.bounds;
  let contentWidth = bounds.maxX - bounds.minX;
  let contentHeight = bounds.maxY - bounds.minY;
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

  const refreshScene = (): void => {
    const worldCenterX = (viewportWidth / 2 - layer.position.x) / layer.scale.x;
    const worldCenterY = (viewportHeight / 2 - layer.position.y) / layer.scale.y;
    const previousScene = renderedWorld.layer;
    renderedWorld = renderWorld(currentWorld, viewState);
    bounds = renderedWorld.bounds;
    contentWidth = bounds.maxX - bounds.minX;
    contentHeight = bounds.maxY - bounds.minY;
    layer.removeChild(previousScene);
    previousScene.destroy({ children: true });
    layer.addChild(renderedWorld.layer);
    layer.position.set(
      viewportWidth / 2 - worldCenterX * layer.scale.x,
      viewportHeight / 2 - worldCenterY * layer.scale.y,
    );
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
    if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 5) {
      pointerDragged = true;
    }
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    clampView();
    event.preventDefault();
  };

  const selectHexAt = (clientX: number, clientY: number): void => {
    const rect = app.canvas.getBoundingClientRect();
    const screenX = ((clientX - rect.left) / Math.max(1, rect.width)) * viewportWidth;
    const screenY = ((clientY - rect.top) / Math.max(1, rect.height)) * viewportHeight;
    const coord = pixelToAxial(
      {
        x: (screenX - layer.position.x) / layer.scale.x,
        y: (screenY - layer.position.y) / layer.scale.y,
      },
      HEX_SIZE,
    );
    const key = axialKey(coord);
    if (!currentWorld.visibleTileKeys.includes(key)) {
      return;
    }
    const tileExists = currentWorld.tiles.some((tile) => axialKey(tile.coord) === key);
    if (!tileExists) {
      return;
    }
    viewState = { ...viewState, selectedTileKey: key };
    refreshScene();
    options?.onHexSelect?.({ key, coord });
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
    update(nextWorld: WorldSnapshot, nextViewState?: HexWorldViewState): void {
      if (destroyed) {
        return;
      }
      currentWorld = nextWorld;
      viewState = patchViewState(viewState, nextViewState);
      refreshScene();
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
      container.style.touchAction = previousTouchAction;
      container.style.overflow = previousOverflow;
      app.destroy(true, { children: true });
    },
  };
}
