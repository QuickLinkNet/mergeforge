import type { HexCoord } from "@mergeforge/domain";
import { Container, Graphics } from "pixi.js";

import { axialToPixel } from "./hex.js";
import { HEX_SIZE } from "./theme.js";
import type { SurveyTentVisualState, WayfinderVisualState } from "./view-state.js";

export function drawWayfinder(target: Container, coord: HexCoord, state: WayfinderVisualState): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const unit = new Container();
  unit.position.set(center.x, center.y + 2);

  const active = state === "active";
  const shadow = new Graphics().ellipse(0, 12, 19, 8).fill({ color: 0x07100f, alpha: 0.42 });
  const marker = new Graphics()
    .circle(0, 4, 16)
    .fill({ color: active ? 0x54d4c2 : 0xe2b861, alpha: 0.12 })
    .stroke({ color: active ? 0x76e3d3 : 0xe9c578, width: 2, alpha: 0.78 });
  const body = new Graphics()
    .circle(0, -12, 5)
    .fill({ color: 0xd7b889, alpha: active ? 1 : 0.68 })
    .poly([-8, 8, -5, -8, 0, -13, 6, -7, 9, 9])
    .fill({ color: active ? 0x276d69 : 0x8a744e, alpha: active ? 1 : 0.68 })
    .stroke({ color: active ? 0x163f42 : 0x59482e, width: 1.2, alpha: 0.9 });
  const pack = new Graphics()
    .roundRect(-10, -7, 7, 12, 2)
    .fill({ color: 0x70472c, alpha: active ? 1 : 0.68 });
  const staff = new Graphics()
    .moveTo(8, 10)
    .lineTo(12, -16)
    .stroke({ color: 0x6e4a2d, width: 2.3, alpha: active ? 1 : 0.72 })
    .poly([12, -21, 16, -16, 12, -11, 8, -16])
    .fill({ color: active ? 0x76ece1 : 0xe5bf66, alpha: active ? 0.92 : 0.58 });
  unit.addChild(shadow, marker, pack, body, staff);

  if (!active) {
    const trainingRing = new Graphics()
      .arc(0, 2, 21, Math.PI * 0.05, Math.PI * 0.62)
      .stroke({ color: 0xf1ca73, width: 2.3, alpha: 0.78 })
      .arc(0, 2, 21, Math.PI * 1.05, Math.PI * 1.62)
      .stroke({ color: 0xf1ca73, width: 2.3, alpha: 0.78 });
    unit.addChild(trainingRing);
  }

  target.addChild(unit);
}

export function drawSurveyTent(
  target: Container,
  villageCoord: HexCoord,
  state: SurveyTentVisualState,
): void {
  const center = axialToPixel(villageCoord, HEX_SIZE);
  const tent = new Container();
  tent.position.set(center.x - 29, center.y + 10);
  const shadow = new Graphics().ellipse(0, 8, 21, 8).fill({ color: 0x07100d, alpha: 0.38 });
  tent.addChild(shadow);

  if (state === "construction") {
    const frame = new Graphics()
      .moveTo(-15, 7)
      .lineTo(0, -13)
      .lineTo(15, 7)
      .moveTo(0, -13)
      .lineTo(0, 8)
      .stroke({ color: 0x8b6239, width: 2.5 })
      .roundRect(-12, 3, 17, 6, 3)
      .fill({ color: 0x4f8580, alpha: 0.78 });
    tent.addChild(frame);
    target.addChild(tent);
    return;
  }

  const canvas = new Graphics()
    .poly([-17, 8, 0, -15, 17, 8])
    .fill({ color: 0x3e8580 })
    .stroke({ color: 0x1b514f, width: 1.3 })
    .poly([0, -15, 17, 8, 2, 6])
    .fill({ color: 0x2d6d69 })
    .moveTo(0, -15)
    .lineTo(0, 8)
    .stroke({ color: 0xc6a263, width: 1.7 });
  const flag = new Graphics()
    .moveTo(0, -15)
    .lineTo(0, -25)
    .stroke({ color: 0x745035, width: 1.6 })
    .poly([0, -25, 10, -21, 0, -17])
    .fill({ color: 0xe0b85c });
  const tripod = new Graphics()
    .circle(19, -1, 3)
    .fill({ color: 0xd7c581 })
    .moveTo(19, 2)
    .lineTo(14, 11)
    .moveTo(19, 2)
    .lineTo(24, 11)
    .stroke({ color: 0x60452f, width: 1.8 });
  tent.addChild(canvas, flag, tripod);
  target.addChild(tent);
}
