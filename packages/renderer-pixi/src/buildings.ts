import type { HexCoord, WorldSnapshot } from "@mergeforge/domain";
import { Container, Graphics } from "pixi.js";

import { tileCoordinateMap } from "./geometry.js";
import { axialToPixel } from "./hex.js";
import { HEX_SIZE } from "./theme.js";
import type {
  BuildingVisual,
  BuildingVisualState,
  FindEffectResource,
  FindEffectVisual,
} from "./view-state.js";
import { filterVisibleVisualOverlays } from "./visual-overlays.js";

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

/** Neutral marker for data-defined module buildings: a stone plinth with a teal crystal. */
function drawModuleBuilding(target: Container, coord: HexCoord, state: BuildingVisualState): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const marker = new Container();
  marker.position.set(center.x, center.y + 3);

  const shadow = new Graphics().ellipse(0, 13, 30, 12).fill({ color: 0x0a120c, alpha: 0.4 });
  const plinth = new Graphics()
    .ellipse(0, 9, 27, 12)
    .fill({ color: state === "construction" ? 0x56606a : 0x4a5560 })
    .stroke({ color: 0x9fb4c0, width: 1.2, alpha: 0.7 });
  marker.addChild(shadow, plinth);

  if (state === "construction") {
    const frame = new Graphics()
      .poly([0, -20, 11, -6, 0, 8, -11, -6])
      .stroke({ color: 0x8ad9cf, width: 1.8, alpha: 0.8 })
      .moveTo(0, -20)
      .lineTo(0, 8)
      .moveTo(-11, -6)
      .lineTo(11, -6)
      .stroke({ color: 0x8ad9cf, width: 1, alpha: 0.5 });
    marker.addChild(frame);
    target.addChild(marker);
    return;
  }

  const glow = new Graphics().circle(0, -6, 17).fill({ color: 0x4fd1c5, alpha: 0.16 });
  const crystal = new Graphics()
    .poly([0, -24, 11, -6, 0, 9, -11, -6])
    .fill({ color: 0x59d6c9 })
    .stroke({ color: 0x1f6f69, width: 1.4 })
    .poly([0, -24, 0, 9, -11, -6])
    .fill({ color: 0x8be8de, alpha: 0.75 });
  marker.addChild(glow, crystal);
  target.addChild(marker);
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

export function drawDataDrivenVisuals(
  target: Container,
  world: WorldSnapshot,
  buildings: readonly BuildingVisual[],
  findEffects: readonly FindEffectVisual[],
): void {
  const tileCoordinates = tileCoordinateMap(world);
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
      } else if (building.type === "module") {
        drawModuleBuilding(target, coord, building.state);
      } else {
        drawLumberCamp(target, coord, building.state);
      }
    }
  }
}
