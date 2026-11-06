import type { HexCoord, WorldSnapshot } from "@mergeforge/domain";
import { Container, Graphics } from "pixi.js";

import { tileCoordinateMap } from "./geometry.js";
import { axialToPixel } from "./hex.js";
import { visibleWorldSites } from "./site-visuals.js";
import { HEX_SIZE } from "./theme.js";

export function drawVillage(target: Container, coord: { readonly q: number; readonly r: number }): void {
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

function drawRelayRuin(target: Container, coord: HexCoord, discoveryHighlight: boolean): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const relay = new Container();
  relay.position.set(center.x, center.y + 2);

  const shadow = new Graphics().ellipse(0, 13, 34, 14).fill({ color: 0x060a0e, alpha: 0.48 });
  const discovery = new Graphics();
  if (discoveryHighlight) {
    discovery
      .circle(0, -3, 36)
      .fill({ color: 0x55dbe0, alpha: 0.08 })
      .arc(0, -3, 34, Math.PI * 0.08, Math.PI * 0.68)
      .stroke({ color: 0x99f8f1, width: 2.8, alpha: 0.82 })
      .arc(0, -3, 34, Math.PI * 1.08, Math.PI * 1.68)
      .stroke({ color: 0x99f8f1, width: 2.8, alpha: 0.82 })
      .poly([0, -52, 6, -45, 0, -38, -6, -45])
      .fill({ color: 0xffd979, alpha: 0.96 })
      .stroke({ color: 0x714f28, width: 1.2 });
  }
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
  relay.addChild(shadow, discovery, plinth, brokenPillars, mast, dormantCore);
  target.addChild(relay);
}

export function drawWorldSiteVisuals(
  target: Container,
  world: WorldSnapshot,
  relayDiscoveryHighlight: boolean,
): void {
  const sites = visibleWorldSites(world, world.visibleTileKeys, relayDiscoveryHighlight);
  const tileCoordinates = tileCoordinateMap(world);

  for (const stoneSite of sites.stoneSites) {
    const coord = tileCoordinates.get(stoneSite.tileKey);
    if (coord !== undefined) {
      drawStoneSource(target, coord);
    }
  }

  if (sites.relaySite !== null) {
    const coord = tileCoordinates.get(sites.relaySite.tileKey);
    if (coord !== undefined) {
      drawRelayRuin(target, coord, sites.relayDiscoveryHighlight);
    }
  }
}
