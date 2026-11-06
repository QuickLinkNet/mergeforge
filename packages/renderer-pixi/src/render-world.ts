import type { WorldSnapshot } from "@mergeforge/domain";
import { Container } from "pixi.js";

import { drawDataDrivenVisuals } from "./buildings.js";
import { worldBounds } from "./camera.js";
import { drawSurveyTent, drawWayfinder } from "./exploration-drawing.js";
import { filterExplorationVisuals } from "./exploration-visuals.js";
import { drawableCoordinates, tileCoordinateMap } from "./geometry.js";
import { axialKey, axialToPixel } from "./hex.js";
import { drawVillage, drawWorldSiteVisuals } from "./landmarks.js";
import { drawInteractionOverlay, drawSurveyTarget } from "./overlay.js";
import { drawRoadNetwork } from "./roads.js";
import { drawTileFace } from "./terrain.js";
import { HEX_SIZE } from "./theme.js";
import type { WorldBounds } from "./types.js";
import type { NormalizedViewState } from "./view-state.js";

export interface RenderedWorld {
  readonly layer: Container;
  readonly bounds: WorldBounds;
}

/** Builds the full layer stack (terrain, roads, landmarks, interaction) for one world snapshot. */
export function renderWorld(world: WorldSnapshot, viewState: NormalizedViewState): RenderedWorld {
  const layer = new Container();
  const terrainLayer = new Container();
  const visible = new Set(world.visibleTileKeys);
  const tileCoordinates = tileCoordinateMap(world);
  const exploration = filterExplorationVisuals(
    viewState.wayfinder,
    viewState.surveyTargetTileKey,
    world.visibleTileKeys,
    [...tileCoordinates.keys()],
  );
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
  drawWorldSiteVisuals(landmarkLayer, world, viewState.relayDiscoveryHighlight);
  drawDataDrivenVisuals(
    landmarkLayer,
    world,
    viewState.buildings,
    viewState.findEffects,
  );
  if (visible.has(axialKey(world.village.coord))) {
    drawVillage(landmarkLayer, world.village.coord);
    if (viewState.surveyTent !== null) {
      drawSurveyTent(landmarkLayer, world.village.coord, viewState.surveyTent.state);
    }
  }
  if (exploration.wayfinder !== null) {
    const coord = tileCoordinates.get(exploration.wayfinder.tileKey);
    if (coord !== undefined) {
      drawWayfinder(landmarkLayer, coord, exploration.wayfinder.state);
    }
  }

  const interactionLayer = new Container();
  drawInteractionOverlay(interactionLayer, world, viewState);
  if (exploration.surveyTargetTileKey !== null) {
    const coord = tileCoordinates.get(exploration.surveyTargetTileKey);
    if (coord !== undefined) {
      drawSurveyTarget(interactionLayer, coord);
    }
  }
  layer.addChild(terrainLayer, roadLayer, landmarkLayer, interactionLayer);

  return { layer, bounds: worldBounds(world) };
}
