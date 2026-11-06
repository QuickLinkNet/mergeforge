import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCatalog,
  hasCompletedChapter,
  hasRelayCapability,
  storageLimits,
  type GameState,
} from '@mergeforge/domain';
import type { FindEffectVisual, HexSelectionEvent } from '@mergeforge/renderer-pixi';
import { bootstrapGame } from '../game/bootstrap';
import { maxPathfinderCharges } from '../game/clock';
import { MODULE_MANIFESTS } from '../game/modules';
import { pathfinderGuidance } from '../game/pathfinderGuidance';
import { relayGuidance } from '../game/relayGuidance';
import type { SinkId } from '../game/sinks';
import { UNIVERSE_SEED, type OnlineSession } from '../online';
import { useAutoDismiss } from './useAutoDismiss';
import { useAutoSave } from './useAutoSave';
import { useBuildActions } from './useBuildActions';
import { useChapterProgress } from './useChapterProgress';
import { useEscapeKey } from './useEscapeKey';
import { useGameClock } from './useGameClock';
import { useHexRenderer } from './useHexRenderer';
import { useMissionText } from './useMissionText';
import { useRadioContacts } from './useRadioContacts';
import { useSelectionPreviews } from './useSelectionPreviews';
import { useSinkNotices } from './useSinkNotices';
import { useSyncStatus } from './useSyncStatus';

const MESSAGE_MS = 4_000;

/** All state, derived values and commands of one game session; the page only renders them. */
export function useGame(online: OnlineSession | undefined) {
  const worldSeed = online?.worldSeed ?? UNIVERSE_SEED;
  const gameStorage = online?.storage;
  const bootstrapNowRef = useRef(Date.now());
  const bootstrap = useMemo(
    () => bootstrapGame(bootstrapNowRef.current, worldSeed, gameStorage ?? window.localStorage),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the session is fixed for the lifetime of the page
    [],
  );

  const [selectedTile, setSelectedTile] = useState<HexSelectionEvent | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(bootstrap.ok ? bootstrap.state : null);
  const [systemNotice, setSystemNotice] = useState<string | null>(bootstrap.ok ? bootstrap.notice : null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [highlightedFindEffects, setHighlightedFindEffects] = useState<readonly FindEffectVisual[]>([]);
  const [signalwerkOpen, setSignalwerkOpen] = useState(false);
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);
  /** Fields highlighted on the map after "Feld wählen" in the build menu. */
  const [placementKeys, setPlacementKeys] = useState<readonly string[]>([]);
  /** Storehouse or upgrade whose confirmation card is open (chosen in the build menu). */
  const [pendingSink, setPendingSink] = useState<SinkId | null>(null);

  const nowMs = useGameClock(bootstrapNowRef.current, setGameState);
  const selection = useSelectionPreviews(gameState, selectedTile, nowMs);
  const guidance = useMemo(() => (gameState === null ? null : pathfinderGuidance(gameState) ?? relayGuidance(gameState)), [gameState]);

  // Picking a field (or closing the highlight) ends the placement help of the build menu.
  useEffect(() => setPlacementKeys((keys) => (keys.length === 0 ? keys : [])), [selectedTile]);

  useAutoSave(gameState, gameStorage, online, setSystemNotice);
  const { syncStatus, loadNewerOnlineSave } = useSyncStatus(online, setSystemNotice);

  const clearFindEffects = useCallback(() => setHighlightedFindEffects([]), []);
  const clearEventMessage = useCallback(() => setEventMessage(null), []);
  const closeSignalwerk = useCallback(() => setSignalwerkOpen(false), []);
  useAutoDismiss(highlightedFindEffects, highlightedFindEffects.length > 0, clearFindEffects, MESSAGE_MS);
  useAutoDismiss(eventMessage, eventMessage !== null, clearEventMessage, MESSAGE_MS);
  useEscapeKey(signalwerkOpen, closeSignalwerk);

  const handleHexSelect = useCallback((event: HexSelectionEvent) => {
    setSelectedTile(event);
    setPendingSink(null);
  }, []);
  useSinkNotices(gameState, setEventMessage);
  const renderer = useHexRenderer({
    bootstrap,
    gameState,
    onHexSelect: handleHexSelect,
    selectedTile,
    placementKeys,
    roadPreview: selection.roadPreview,
    surveyPreview: selection.surveyPreview,
    guidance,
    findEffects: highlightedFindEffects,
    pathfinder: selection.pathfinder,
    surveyTent: selection.surveyTent,
    relayDiscovered: selection.relayDiscovered,
  });

  const actions = useBuildActions({
    gameState,
    selectedTile,
    commandNowMs: selection.commandNowMs,
    buildingPlan: selection.buildingPlan,
    setGameState,
    setSelectedTile,
    setEventMessage,
    setHighlightedFindEffects,
    setPlacementKeys,
    setBuildMenuOpen,
    setPendingSink,
  });

  const catalog = useMemo(() => buildCatalog(MODULE_MANIFESTS), []);
  const cancelSelection = useCallback(() => setSelectedTile(null), []);
  const changeGameState = useCallback((update: (state: GameState) => GameState) => {
    setGameState((current) => (current === null ? current : update(current)));
  }, []);

  const chapterSixComplete = gameState === null ? false : hasCompletedChapter(gameState, 6);
  const chapterSevenComplete = gameState === null ? false : hasCompletedChapter(gameState, 7);
  const signalNetworkActive = gameState !== null && hasRelayCapability(gameState, 'signal_network_active');
  const radioContacts = useRadioContacts(signalNetworkActive, online);

  const dismissSystemNotice = useCallback(() => setSystemNotice(null), []);
  const openSignalwerk = useCallback(() => setSignalwerkOpen(true), []);
  const closeBuildMenu = useCallback(() => setBuildMenuOpen(false), []);
  const toggleBuildMenu = useCallback(() => setBuildMenuOpen((open) => !open), []);
  const cancelPendingSink = useCallback(() => setPendingSink(null), []);
  const storage = useMemo(() => (gameState === null ? null : storageLimits(gameState)), [gameState]);

  const mission = useMissionText(gameState);
  const { chapterBanner, dismissChapterBanner } = useChapterProgress(gameState, mission);

  return {
    online,
    worldSeed,
    bootstrap,
    gameState,
    selectedTile,
    selection,
    guidance,
    mission,
    renderer,
    actions,
    catalog,
    syncStatus,
    loadNewerOnlineSave,
    systemNotice,
    dismissSystemNotice,
    eventMessage,
    chapterBanner,
    dismissChapterBanner,
    signalwerkOpen,
    openSignalwerk,
    closeSignalwerk,
    buildMenuOpen,
    closeBuildMenu,
    toggleBuildMenu,
    pendingSink,
    cancelPendingSink,
    storageLimits: storage,
    highlightFields: setPlacementKeys,
    cancelSelection,
    changeGameState,
    chapterSixComplete,
    chapterSevenComplete,
    signalNetworkActive,
    radioContacts,
    maxPathfinderCharges: maxPathfinderCharges(selection.surveyTent),
  };
}

export type GameController = ReturnType<typeof useGame>;
