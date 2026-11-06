import { useMemo } from 'react';
import {
  buildRoad,
  hasCompletedChapter,
  hasPrologueEvent,
  isProducingBuilding,
  movePathfinder,
  startLumberCamp,
  startPathfinderTraining,
  startQuarry,
  startRelayRepair,
  startSurveyTent,
  startWorkshop,
  surveyWithPathfinder,
  type GameState,
} from '@mergeforge/domain';
import type { HexSelectionEvent } from '@mergeforge/renderer-pixi';
import { planBuilding, type ProductionBuilding } from '../game/buildings';

/**
 * What the selected tile offers: dry runs of every possible command for the build cards.
 * Nothing here changes the game state; the previews only decide which card is shown.
 */
export function useSelectionPreviews(gameState: GameState | null, selectedTile: HexSelectionEvent | null, nowMs: number) {
  const selectedWorldTile = useMemo(
    () =>
      gameState === null || selectedTile === null
        ? undefined
        : gameState.world.tiles.find(
            (tile) => `${tile.coord.q},${tile.coord.r}` === selectedTile.key,
          ),
    [gameState, selectedTile],
  );
  const selectedBuilding = useMemo(
    (): ProductionBuilding | undefined => {
      return gameState?.buildings.find(
        (entry): entry is ProductionBuilding => entry.tileKey === selectedTile?.key && isProducingBuilding(entry),
      );
    },
    [gameState?.buildings, selectedTile?.key],
  );
  const pathfinder = gameState?.units.find((unit) => unit.type === 'pathfinder');
  const surveyTent = gameState?.buildings.find((building) => building.type === 'survey-tent');
  const workshop = gameState?.buildings.find((building) => building.type === 'workshop');
  const relayDiscovered = gameState === null ? false : hasPrologueEvent(gameState, 'relay_discovered');
  const signalwerkUnlocked = gameState === null ? false : hasCompletedChapter(gameState, 5);
  const signalwerkSolved = gameState?.signalwerk.solved ?? false;
  const relayStatus = gameState?.relay.status ?? 'dormant';
  const isRelaySelected =
    selectedTile?.key === gameState?.world.relaySite.tileKey && signalwerkUnlocked;
  const villageTileKey = gameState === null
    ? null
    : `${gameState.world.village.coord.q},${gameState.world.village.coord.r}`;
  const isVillageSelected = selectedTile?.key === villageTileKey;
  const selectedStoneSite =
    gameState?.world.resourceSites.find(
      (site) => site.type === 'stone' && site.tileKey === selectedTile?.key,
    ) ?? null;
  const isLumberCampSite =
    gameState !== null &&
    selectedTile !== null &&
    selectedBuilding === undefined &&
    selectedStoneSite === null &&
    selectedWorldTile?.terrain === 'forest' &&
    gameState.roadTileKeys.includes(selectedTile.key);
  const isQuarrySite =
    gameState !== null &&
    selectedTile !== null &&
    selectedBuilding === undefined &&
    gameState.roadTileKeys.includes(selectedTile.key) &&
    selectedStoneSite !== null;
  const commandNowMs = gameState === null ? nowMs : Math.max(nowMs, gameState.lastAdvancedAtMs);

  const trainingPreview = useMemo(() => {
    if (gameState === null || !isVillageSelected || pathfinder !== undefined) return null;
    return startPathfinderTraining(gameState, commandNowMs);
  }, [commandNowMs, gameState, isVillageSelected, pathfinder]);
  const surveyTentPreview = useMemo(() => {
    if (
      gameState === null ||
      !isVillageSelected ||
      pathfinder?.status !== 'active' ||
      surveyTent !== undefined
    ) return null;
    return startSurveyTent(gameState, commandNowMs);
  }, [commandNowMs, gameState, isVillageSelected, pathfinder?.status, surveyTent]);
  const workshopPreview = useMemo(() => {
    if (gameState === null || !isVillageSelected || !signalwerkSolved || workshop !== undefined) return null;
    return startWorkshop(gameState, commandNowMs);
  }, [commandNowMs, gameState, isVillageSelected, signalwerkSolved, workshop]);
  const relayRepairPreview = useMemo(() => {
    if (gameState === null || !isRelaySelected || !signalwerkSolved || relayStatus !== 'dormant') return null;
    return startRelayRepair(gameState, commandNowMs);
  }, [commandNowMs, gameState, isRelaySelected, relayStatus, signalwerkSolved]);
  const surveyPreview = useMemo(() => {
    if (
      gameState === null ||
      selectedTile === null ||
      pathfinder?.status !== 'active' ||
      gameState.visibleTileKeys.includes(selectedTile.key)
    ) return null;
    return surveyWithPathfinder(gameState, selectedTile.coord, commandNowMs);
  }, [commandNowMs, gameState, pathfinder?.status, selectedTile]);

  const roadPreview = useMemo(() => {
    if (
      gameState === null ||
      selectedTile === null ||
      isVillageSelected ||
      isLumberCampSite ||
      isQuarrySite ||
      selectedBuilding !== undefined
      || trainingPreview !== null
      || surveyTentPreview !== null
      || workshopPreview !== null
      || surveyPreview !== null
      || isRelaySelected
    ) {
      return null;
    }
    return buildRoad(gameState, selectedTile.coord);
  }, [gameState, isLumberCampSite, isQuarrySite, isRelaySelected, isVillageSelected, selectedBuilding, selectedTile, surveyPreview, surveyTentPreview, trainingPreview, workshopPreview]);
  const lumberCampPreview = useMemo(() => {
    if (gameState === null || selectedTile === null || !isLumberCampSite) return null;
    return startLumberCamp(gameState, selectedTile.coord, commandNowMs);
  }, [commandNowMs, gameState, isLumberCampSite, selectedTile]);
  const quarryPreview = useMemo(() => {
    if (gameState === null || selectedTile === null || !isQuarrySite) return null;
    return startQuarry(gameState, selectedTile.coord, commandNowMs);
  }, [commandNowMs, gameState, isQuarrySite, selectedTile]);

  const buildingPlan = planBuilding(lumberCampPreview, quarryPreview);

  const movementPreview = useMemo(() => {
    if (
      gameState === null ||
      selectedTile === null ||
      pathfinder?.status !== 'active' ||
      selectedTile.key === pathfinder.tileKey ||
      surveyPreview !== null ||
      trainingPreview !== null ||
      surveyTentPreview !== null
      || workshopPreview !== null
      || (isVillageSelected && workshop !== undefined)
    ) return null;
    const canBeDestination = selectedTile.key === villageTileKey
      || gameState.roadTileKeys.includes(selectedTile.key);
    return canBeDestination
      ? movePathfinder(gameState, selectedTile.coord, commandNowMs)
      : null;
  }, [buildingPlan, commandNowMs, gameState, isVillageSelected, pathfinder, selectedBuilding, selectedTile, surveyPreview, surveyTentPreview, trainingPreview, villageTileKey, workshop, workshopPreview]);

  const newlyRevealedCount = useMemo(() => {
    if (gameState === null || roadPreview?.ok !== true) return 0;
    const currentlyVisible = new Set(gameState.visibleTileKeys);
    return roadPreview.state.visibleTileKeys.filter((key) => !currentlyVisible.has(key)).length;
  }, [gameState, roadPreview]);

  return {
    selectedBuilding,
    pathfinder,
    surveyTent,
    workshop,
    relayDiscovered,
    signalwerkSolved,
    relayStatus,
    isRelaySelected,
    isVillageSelected,
    commandNowMs,
    trainingPreview,
    surveyTentPreview,
    workshopPreview,
    relayRepairPreview,
    surveyPreview,
    roadPreview,
    buildingPlan,
    movementPreview,
    newlyRevealedCount,
  };
}

export type SelectionPreviews = ReturnType<typeof useSelectionPreviews>;
