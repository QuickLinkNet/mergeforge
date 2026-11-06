import type { HexCoord } from "@mergeforge/domain";
import { Container, Graphics } from "pixi.js";

import { areNeighbors } from "./geometry.js";
import { axialToPixel } from "./hex.js";
import { HEX_SIZE, roadColors } from "./theme.js";

function addRoadSegment(graphics: Graphics, from: HexCoord, to: HexCoord): void {
  const start = axialToPixel(from, HEX_SIZE);
  const end = axialToPixel(to, HEX_SIZE);
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y);
}

export function drawRoadNetwork(
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

  const colors = preview ? roadColors.preview : roadColors.built;
  const alpha = preview ? 0.72 : 1;
  underlay.stroke({ color: colors.underlay, width: 13, alpha: alpha * 0.9 });
  road.stroke({ color: colors.road, width: 8, alpha });
  highlight.stroke({ color: colors.highlight, width: 2, alpha: alpha * 0.8 });
  target.addChild(underlay, road, highlight);

  const nodes = new Graphics();
  for (const coord of coordinates.values()) {
    const point = axialToPixel(coord, HEX_SIZE);
    nodes
      .circle(point.x, point.y, preview ? 7 : 8)
      .fill({ color: colors.nodeFill, alpha })
      .stroke({ color: colors.nodeStroke, width: 2, alpha });
  }
  target.addChild(nodes);
}
