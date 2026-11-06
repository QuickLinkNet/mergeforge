import type { HexCoord, WorldSnapshot } from "@mergeforge/domain";
import { Container, Graphics } from "pixi.js";

import { existingCoordinates, polygonPoints } from "./geometry.js";
import { axialKey, axialToPixel, hexCorners } from "./hex.js";
import { HEX_SIZE, overlayColors } from "./theme.js";
import type { NormalizedViewState } from "./view-state.js";

/** Selection outline plus road-preview outlines (both also shown on fogged tiles). */
export function drawInteractionOverlay(
  target: Container,
  world: WorldSnapshot,
  viewState: NormalizedViewState,
): void {
  if (viewState.selectedTileKey !== null) {
    const tile = world.tiles.find((candidate) => axialKey(candidate.coord) === viewState.selectedTileKey);
    if (tile !== undefined) {
      const center = axialToPixel(tile.coord, HEX_SIZE);
      const selection = new Graphics()
        .poly(polygonPoints(hexCorners(center, HEX_SIZE - 3)))
        .fill({ color: overlayColors.selectionFill, alpha: 0.12 })
        .stroke({ color: overlayColors.selectionStroke, width: 3.2, alpha: 0.98 });
      target.addChild(selection);
    }
  }

  const previewCoordinates = existingCoordinates(world, viewState.roadPreviewTileKeys);
  if (previewCoordinates.size > 0) {
    const outlines = new Graphics();
    for (const coord of previewCoordinates.values()) {
      const center = axialToPixel(coord, HEX_SIZE);
      outlines
        .poly(polygonPoints(hexCorners(center, HEX_SIZE - 7)))
        .fill({ color: overlayColors.roadPreviewOutlineFill, alpha: 0.08 })
        .stroke({ color: overlayColors.roadPreviewOutlineStroke, width: 2, alpha: 0.75 });
    }
    target.addChild(outlines);
  }
}

/** Crosshair highlight on the hex the pathfinder survey currently targets. */
export function drawSurveyTarget(target: Container, coord: HexCoord): void {
  const center = axialToPixel(coord, HEX_SIZE);
  const corners = polygonPoints(hexCorners(center, HEX_SIZE - 5));
  const overlay = new Graphics()
    .poly(corners)
    .fill({ color: overlayColors.surveyTargetFill, alpha: 0.12 })
    .stroke({ color: overlayColors.surveyTargetStroke, width: 3, alpha: 0.95 })
    .circle(center.x, center.y, 11)
    .stroke({ color: overlayColors.surveyTargetRing, width: 2, alpha: 0.88 })
    .moveTo(center.x - 17, center.y)
    .lineTo(center.x - 8, center.y)
    .moveTo(center.x + 8, center.y)
    .lineTo(center.x + 17, center.y)
    .moveTo(center.x, center.y - 17)
    .lineTo(center.x, center.y - 8)
    .moveTo(center.x, center.y + 8)
    .lineTo(center.x, center.y + 17)
    .stroke({ color: overlayColors.surveyTargetCross, width: 2, alpha: 0.82 });
  target.addChild(overlay);
}
