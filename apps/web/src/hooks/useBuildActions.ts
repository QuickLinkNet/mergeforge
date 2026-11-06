import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  WORLD_PULSE_MS,
  advanceTime,
  buildRoad,
  hasPrologueEvent,
  movePathfinder,
  rotateSignalwerkRune,
  scanFarSignals,
  startLumberCamp,
  startModuleBuilding,
  startPathfinderTraining,
  startQuarry,
  startRelayRepair,
  startSurveyTent,
  startWorkshop,
  surveyWithPathfinder,
  type CatalogEntry,
  type GameState,
  type ModuleManifest,
} from '@mergeforge/domain';
import type { FindEffectVisual, HexSelectionEvent } from '@mergeforge/renderer-pixi';
import type { BuildingPlan } from '../game/buildings';
import type { MenuStatus } from '../game/buildMenuStatus';
import { formatRemaining } from '../game/copy';
import { describeRoadOutcome } from '../game/roadFinds';
import { useCommandGuard } from './useCommandGuard';

export interface BuildActionsInput {
  readonly gameState: GameState | null;
  readonly selectedTile: HexSelectionEvent | null;
  readonly commandNowMs: number;
  readonly buildingPlan: BuildingPlan | null;
  readonly setGameState: Dispatch<SetStateAction<GameState | null>>;
  readonly setSelectedTile: (tile: HexSelectionEvent | null) => void;
  readonly setEventMessage: (message: string | null) => void;
  readonly setHighlightedFindEffects: (effects: readonly FindEffectVisual[]) => void;
  readonly setPlacementKeys: (keys: readonly string[]) => void;
  readonly setBuildMenuOpen: (open: boolean) => void;
}

/** Every player command: runs the domain rule, stores the result and announces it. */
export function useBuildActions(input: BuildActionsInput) {
  const { gameState, selectedTile, commandNowMs, buildingPlan } = input;
  const { setGameState, setSelectedTile, setEventMessage, setHighlightedFindEffects, setPlacementKeys, setBuildMenuOpen } = input;

  const confirmRoadRaw = useCallback(() => {
    if (gameState === null || selectedTile === null) return;
    const result = buildRoad(gameState, selectedTile.coord);
    if (!result.ok) return;
    const outcome = describeRoadOutcome(gameState, result.state);
    setGameState(result.state);
    setSelectedTile(null);
    if (outcome.effects !== null) setHighlightedFindEffects(outcome.effects);
    if (outcome.message !== null) setEventMessage(outcome.message);
  }, [gameState, selectedTile]); // eslint-disable-line react-hooks/exhaustive-deps -- setters are stable

  const confirmBuildingRaw = useCallback(() => {
    if (gameState === null || selectedTile === null || buildingPlan === null) return;
    const result =
      buildingPlan.type === 'lumber-camp'
        ? startLumberCamp(gameState, selectedTile.coord, commandNowMs)
        : startQuarry(gameState, selectedTile.coord, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage(`${buildingPlan.name} beauftragt · Fertigstellung in 10:00`);
  }, [buildingPlan, commandNowMs, gameState, selectedTile]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmModuleBuildingRaw = useCallback((manifest: ModuleManifest) => {
    if (gameState === null || selectedTile === null) return;
    const result = startModuleBuilding(gameState, manifest, selectedTile.coord, commandNowMs);
    setGameState(result.state);
    if (result.ok) {
      setEventMessage(`${manifest.name} beauftragt · Fertigstellung in ${formatRemaining(manifest.building.buildTimeMs)}`);
    }
  }, [commandNowMs, gameState, selectedTile]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmTrainingRaw = useCallback(() => {
    if (gameState === null) return;
    const result = startPathfinderTraining(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Wegfinder in Ausbildung · Bereit in 10:00');
  }, [commandNowMs, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmMovementRaw = useCallback(() => {
    if (gameState === null || selectedTile === null) return;
    const result = movePathfinder(gameState, selectedTile.coord, commandNowMs);
    setGameState(result.state);
    if (result.ok) {
      setEventMessage(`Wegfinder erreicht ${selectedTile.coord.q}, ${selectedTile.coord.r}`);
      setSelectedTile(null);
    }
  }, [commandNowMs, gameState, selectedTile]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmSurveyRaw = useCallback(() => {
    if (gameState === null || selectedTile === null) return;
    const relayWasDiscovered = hasPrologueEvent(gameState, 'relay_discovered');
    const result = surveyWithPathfinder(gameState, selectedTile.coord, commandNowMs);
    setGameState(result.state);
    if (result.ok) {
      setEventMessage(
        !relayWasDiscovered && hasPrologueEvent(result.state, 'relay_discovered')
          ? 'Relais entdeckt · Das tote Signal liegt frei'
          : 'Vermessung abgeschlossen · 1 Hex kartiert',
      );
      setSelectedTile(null);
    }
  }, [commandNowMs, gameState, selectedTile]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmSurveyTentRaw = useCallback(() => {
    if (gameState === null) return;
    const result = startSurveyTent(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Vermesserzelt beauftragt · Fertigstellung in 10:00');
  }, [commandNowMs, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmWorkshopRaw = useCallback(() => {
    if (gameState === null) return;
    const result = startWorkshop(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Werkstatt beauftragt · Fertigstellung in 20:00');
  }, [commandNowMs, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmRelayRepairRaw = useCallback(() => {
    if (gameState === null) return;
    const result = startRelayRepair(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Resonanzkern installiert · Relais bereit in 30:00');
  }, [commandNowMs, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmSignalScanRaw = useCallback(() => {
    if (gameState === null) return;
    const result = scanFarSignals(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Signalnetz aktiv · Zwei Fernsignale empfangen');
  }, [commandNowMs, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardCommand = useCommandGuard();
  const confirmRoad = guardCommand(confirmRoadRaw);
  const confirmBuilding = guardCommand(confirmBuildingRaw);
  const confirmModuleBuilding = guardCommand(confirmModuleBuildingRaw);
  const confirmTraining = guardCommand(confirmTrainingRaw);
  const confirmMovement = guardCommand(confirmMovementRaw);
  const confirmSurvey = guardCommand(confirmSurveyRaw);
  const confirmSurveyTent = guardCommand(confirmSurveyTentRaw);
  const confirmWorkshop = guardCommand(confirmWorkshopRaw);
  const confirmRelayRepair = guardCommand(confirmRelayRepairRaw);
  const confirmSignalScan = guardCommand(confirmSignalScanRaw);

  const rotateRune = useCallback((index: number) => {
    if (gameState === null) return;
    const wasSolved = gameState.signalwerk.solved;
    const result = rotateSignalwerkRune(gameState, index);
    setGameState(result.state);
    if (result.ok && !wasSolved && result.state.signalwerk.solved) {
      setEventMessage('Signalwerk gelöst · Resonanzkern geborgen');
    }
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMenuAction = useCallback((entry: CatalogEntry, status: MenuStatus) => {
    if (status.kind === 'field') {
      setPlacementKeys(status.candidates);
      setBuildMenuOpen(false);
      setEventMessage(`${entry.name}: Wähle ein markiertes Feld (${entry.condition})`);
      return;
    }
    if (status.kind !== 'ready') return;
    if (entry.id === 'pathfinder') confirmTraining();
    else if (entry.id === 'survey-tent') confirmSurveyTent();
    else if (entry.id === 'workshop') confirmWorkshop();
    else if (entry.id === 'relay-repair') confirmRelayRepair();
    else if (entry.id === 'signal-scan') confirmSignalScan();
  }, [confirmRelayRepair, confirmSignalScan, confirmSurveyTent, confirmTraining, confirmWorkshop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Maintainer test tool: one world pulse forward. The clock never runs backwards, so the
  // game simply stays ahead of the wall clock until real time catches up.
  const skipOnePulse = useCallback(() => {
    setGameState((current) => {
      if (current === null) return current;
      return advanceTime(current, Math.max(Date.now(), current.lastAdvancedAtMs) + WORLD_PULSE_MS);
    });
    setEventMessage('Testmodus: 10 Minuten vorgespult');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    confirmRoad,
    confirmBuilding,
    confirmModuleBuilding,
    confirmTraining,
    confirmMovement,
    confirmSurvey,
    confirmSurveyTent,
    confirmWorkshop,
    confirmRelayRepair,
    confirmSignalScan,
    rotateRune,
    handleMenuAction,
    skipOnePulse,
  };
}

export type BuildActions = ReturnType<typeof useBuildActions>;
