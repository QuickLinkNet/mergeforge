import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FOREST_SURFACE_WOOD,
  LUMBER_CAMP_STONE_COST,
  LUMBER_CAMP_WOOD_COST,
  LUMBER_CAMP_WOOD_PER_PULSE,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_CHARGES_PER_PULSE,
  PATHFINDER_STONE_COST,
  PATHFINDER_WOOD_COST,
  QUARRY_STONE_COST,
  QUARRY_STONE_PER_PULSE,
  QUARRY_WOOD_COST,
  ROAD_WOOD_COST,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  SURVEY_TENT_STONE_COST,
  SURVEY_TENT_WOOD_COST,
  WORKSHOP_BUILD_MS,
  WORKSHOP_STONE_COST,
  WORKSHOP_WOOD_COST,
  RELAY_REPAIR_MS,
  RELAY_REPAIR_STONE_COST,
  RELAY_REPAIR_WOOD_COST,
  WORLD_PULSE_MS,
  advanceTime,
  buildRoad,
  createInitialGameState,
  hasCompletedChapter,
  hasPrologueEvent,
  movePathfinder,
  rotateSignalwerkRune,
  startPathfinderTraining,
  startLumberCamp,
  startQuarry,
  startSurveyTent,
  startWorkshop,
  startRelayRepair,
  surveyWithPathfinder,
  type BuildRoadRejection,
  type GameState,
  type MovePathfinderRejection,
  type StartLumberCampRejection,
  type StartPathfinderTrainingRejection,
  type StartQuarryRejection,
  type StartSurveyTentRejection,
  type StartWorkshopRejection,
  type StartRelayRepairRejection,
  type SurveyWithPathfinderRejection,
  type WorldSnapshot,
} from '@mergeforge/domain';
import {
  mountHexWorld,
  type HexSelectionEvent,
  type HexWorldViewState,
  type FindEffectVisual,
  type MountedHexWorld,
} from '@mergeforge/renderer-pixi';
import {
  createSignalwerkPuzzle,
  tileConnections,
  type SignalDirection,
} from '@mergeforge/signalwerk';
import { generateWorld } from '@mergeforge/worldgen';
import { loadGame, saveGame } from './persistence';

const WORLD_SEED = 'mergeforge-genesis-001';
const WORLD_RADIUS = 12;
const CHAPTER_ONE_ROAD_TARGET = 2;

type ViewState = 'loading' | 'ready' | 'error';

type BootstrapResult =
  | { readonly ok: true; readonly state: GameState; readonly notice: string | null }
  | { readonly ok: false; readonly error: string };

const roadFailureCopy: Readonly<Record<BuildRoadRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-visible': 'Dieses Feld liegt noch hinter dem Nebel.',
  'not-traversable': 'Auf diesem Gelände kann keine Straße entstehen.',
  'village-tile': 'Der Dorfkern ist bereits der Ausgangspunkt eures Straßennetzes.',
  'already-road': 'Auf diesem Feld liegt bereits eine Straße.',
  'not-connected': 'Die Straße muss am Dorf oder Straßennetz anschließen.',
  'insufficient-wood': 'Für diese Straße fehlt Holz.',
};

const lumberFailureCopy: Readonly<Record<StartLumberCampRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-forest': 'Ein Holzfällerlager benötigt ein Waldfeld.',
  'road-required': 'Das Waldfeld muss zuerst per Straße verbunden werden.',
  'already-built': 'Auf diesem Waldfeld steht bereits ein Holzfällerlager.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Gebäude.',
  'insufficient-resources': 'Für das Holzfällerlager fehlen Rohstoffe.',
};

const quarryFailureCopy: Readonly<Record<StartQuarryRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-stone-site': 'Ein Steinbruch benötigt ein ausgewiesenes Steinvorkommen.',
  'road-required': 'Das Steinvorkommen muss zuerst per Straße verbunden werden.',
  'already-built': 'Auf diesem Vorkommen steht bereits ein Steinbruch.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Gebäude.',
  'insufficient-resources': 'Für den Steinbruch fehlen Rohstoffe.',
};

const trainingFailureCopy: Readonly<Record<StartPathfinderTrainingRejection, string>> = {
  'already-exists': 'Euer Dorf besitzt bereits einen Wegfinder.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'insufficient-resources': 'Für die Ausbildung fehlen Holz oder Stein.',
};

const movementFailureCopy: Readonly<Record<MovePathfinderRejection, string>> = {
  'pathfinder-not-found': 'Im Dorf ist noch kein Wegfinder ausgebildet.',
  'pathfinder-not-active': 'Der Wegfinder befindet sich noch in Ausbildung.',
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-road-network': 'Der Wegfinder bewegt sich nur auf dem verbundenen Straßennetz.',
};

const surveyFailureCopy: Readonly<Record<SurveyWithPathfinderRejection, string>> = {
  'pathfinder-not-found': 'Im Dorf ist noch kein Wegfinder ausgebildet.',
  'pathfinder-not-active': 'Der Wegfinder befindet sich noch in Ausbildung.',
  'roadhead-required': 'Vermessungen beginnen an einem Straßenkopf.',
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-in-survey-range': 'Das Ziel liegt außerhalb der Vermessungsreichweite.',
  'already-visible': 'Dieses Feld ist bereits kartiert.',
  'no-charges': 'Die nächste Expeditionsladung ist noch nicht bereit.',
};

const surveyTentFailureCopy: Readonly<Record<StartSurveyTentRejection, string>> = {
  'already-built': 'Das Vermesserzelt steht bereits am Dorf.',
  'pathfinder-required': 'Das Vermesserzelt wird erst mit einem aktiven Wegfinder freigeschaltet.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'insufficient-resources': 'Für das Vermesserzelt fehlen Holz oder Stein.',
};

const workshopFailureCopy: Readonly<Record<StartWorkshopRejection, string>> = {
  locked: 'Die Werkstatt wird erst nach dem gelösten Signalwerk freigeschaltet.',
  'already-built': 'Die Werkstatt steht bereits im Dorf.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'insufficient-resources': 'Für die Werkstatt fehlen Holz oder Stein.',
};

const relayRepairFailureCopy: Readonly<Record<StartRelayRepairRejection, string>> = {
  locked: 'Das Relais ist noch nicht für die Reparatur freigeschaltet.',
  'workshop-required': 'Für die Reparatur wird eine aktive Werkstatt benötigt.',
  'already-started': 'Die Relaisreparatur wurde bereits begonnen.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'core-required': 'Der Resonanzkern fehlt.',
  'insufficient-resources': 'Für die Relaisreparatur fehlen Holz oder Stein.',
};

function bootstrapGame(nowMs: number): BootstrapResult {
  try {
    const world = generateWorld({ seed: WORLD_SEED, radius: WORLD_RADIUS });
    const freshState = createInitialGameState(world, nowMs);
    let loaded: ReturnType<typeof loadGame>;
    try {
      loaded = loadGame(window.localStorage, world);
    } catch {
      return {
        ok: true,
        state: freshState,
        notice: 'Der lokale Speicher ist nicht verfügbar. Diese Sitzung läuft ohne Speicherung.',
      };
    }

    if (loaded.kind === 'loaded') {
      return {
        ok: true,
        state: advanceTime(loaded.state, Math.max(nowMs, loaded.state.lastAdvancedAtMs)),
        notice: null,
      };
    }
    if (loaded.kind === 'reset') {
      return {
        ok: true,
        state: freshState,
        notice:
          loaded.reason === 'incompatible'
            ? 'Der ältere Spielstand passt nicht zu dieser Weltversion und wurde sicher neu begonnen.'
            : 'Der lokale Spielstand war beschädigt und wurde sicher zurückgesetzt.',
      };
    }
    return { ok: true, state: freshState, notice: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Die Welt konnte nicht erzeugt werden.',
    };
  }
}

function worldForRenderer(state: GameState): WorldSnapshot {
  return { ...state.world, visibleTileKeys: state.visibleTileKeys };
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secondsPart = (seconds % 60).toString().padStart(2, '0');
  return `${minutesPart}:${secondsPart}`;
}

const directionCopy: Readonly<Record<SignalDirection, string>> = {
  north: 'Norden',
  east: 'Osten',
  south: 'Süden',
  west: 'Westen',
};

function nextSettlementAt(state: GameState): number {
  const surveyTent = state.buildings.find((building) => building.type === 'survey-tent');
  const maxCharges = surveyTent?.status === 'active'
    ? PATHFINDER_EXPANDED_MAX_CHARGES
    : PATHFINDER_BASE_MAX_CHARGES;
  const buildingEvents = state.buildings.map((building) => {
    if (building.status === 'constructing') return building.completesAtMs;
    return building.type === 'survey-tent' || building.type === 'workshop'
      ? Number.POSITIVE_INFINITY
      : building.lastProductionAtMs + WORLD_PULSE_MS;
  });
  const unitEvents = state.units.map((unit) =>
    unit.status === 'training'
      ? unit.completesAtMs
      : unit.charges < maxCharges
        ? unit.lastChargeAtMs + WORLD_PULSE_MS
        : Number.POSITIVE_INFINITY,
  );
  const relayEvent = state.relay.status === 'repairing'
    ? state.relay.completesAtMs
    : Number.POSITIVE_INFINITY;
  return Math.min(...buildingEvents, ...unitEvents, relayEvent, Number.POSITIVE_INFINITY);
}

export function App() {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MountedHexWorld | undefined>(undefined);
  const latestRenderRef = useRef<{
    world: WorldSnapshot;
    view: HexWorldViewState;
  } | undefined>(undefined);
  const bootstrapNowRef = useRef(Date.now());
  const bootstrap = useMemo(() => bootstrapGame(bootstrapNowRef.current), []);

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedTile, setSelectedTile] = useState<HexSelectionEvent | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(bootstrap.ok ? bootstrap.state : null);
  const [nowMs, setNowMs] = useState(bootstrapNowRef.current);
  const [systemNotice, setSystemNotice] = useState<string | null>(bootstrap.ok ? bootstrap.notice : null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [highlightedFindEffects, setHighlightedFindEffects] = useState<readonly FindEffectVisual[]>([]);
  const [signalwerkOpen, setSignalwerkOpen] = useState(false);

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
    () => {
      const building = gameState?.buildings.find((entry) => entry.tileKey === selectedTile?.key);
      return building?.type === 'survey-tent' || building?.type === 'workshop' ? undefined : building;
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
  const signalwerkPuzzle = useMemo(
    () => gameState === null ? null : createSignalwerkPuzzle(gameState.signalwerk.seed),
    [gameState?.signalwerk.seed],
  );
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

  const buildingPlan =
    lumberCampPreview !== null
      ? {
          type: 'lumber-camp' as const,
          name: 'Holzfällerlager',
          icon: '♜',
          result: lumberCampPreview,
          woodCost: LUMBER_CAMP_WOOD_COST,
          stoneCost: LUMBER_CAMP_STONE_COST,
          output: `+${LUMBER_CAMP_WOOD_PER_PULSE} Holz / Takt`,
          action: 'Lager errichten',
        }
      : quarryPreview !== null
        ? {
            type: 'quarry' as const,
            name: 'Steinbruch',
            icon: '◆',
            result: quarryPreview,
            woodCost: QUARRY_WOOD_COST,
            stoneCost: QUARRY_STONE_COST,
            output: `+${QUARRY_STONE_PER_PULSE} Stein / Takt`,
            action: 'Steinbruch errichten',
          }
        : null;

  const movementPreview = useMemo(() => {
    if (
      gameState === null ||
      selectedTile === null ||
      pathfinder?.status !== 'active' ||
      selectedTile.key === pathfinder.tileKey ||
      selectedBuilding !== undefined ||
      buildingPlan !== null ||
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

  const effectiveWorld = useMemo(
    () => (gameState === null ? null : worldForRenderer(gameState)),
    [gameState],
  );
  const rendererView = useMemo<HexWorldViewState>(
    () => ({
      selectedTileKey: selectedTile?.key ?? null,
      roadTileKeys: gameState?.roadTileKeys ?? [],
      roadPreviewTileKeys:
        selectedTile !== null && roadPreview?.ok === true ? [selectedTile.key] : [],
      buildings:
        gameState?.buildings
          .filter((building) => building.type !== 'survey-tent' && building.type !== 'workshop')
          .map((building) => ({
            tileKey: building.tileKey,
            type: building.type,
            state: building.status === 'constructing' ? 'construction' : 'complete',
          })) ?? [],
      findEffects: highlightedFindEffects,
      wayfinder: pathfinder === undefined
        ? null
        : {
            tileKey: pathfinder.tileKey,
            state: pathfinder.status,
          },
      surveyTargetTileKey: surveyPreview?.ok === true ? selectedTile?.key ?? null : null,
      surveyTent: surveyTent === undefined
        ? null
        : { state: surveyTent.status === 'constructing' ? 'construction' : 'complete' },
      relayDiscoveryHighlight: relayDiscovered,
    }),
    [gameState?.buildings, gameState?.roadTileKeys, highlightedFindEffects, pathfinder, relayDiscovered, roadPreview, selectedTile, surveyPreview, surveyTent],
  );

  if (effectiveWorld !== null) latestRenderRef.current = { world: effectiveWorld, view: rendererView };

  const handleHexSelect = useCallback((event: HexSelectionEvent) => setSelectedTile(event), []);

  useEffect(() => {
    if (gameState === null) return;
    let saved = false;
    try {
      saved = saveGame(window.localStorage, gameState);
    } catch {
      saved = false;
    }
    if (!saved) setSystemNotice('Der lokale Spielstand konnte nicht gespeichert werden.');
  }, [gameState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      setGameState((current) => {
        if (current === null) return current;
        const safeNow = Math.max(currentNow, current.lastAdvancedAtMs);
        return safeNow >= nextSettlementAt(current) ? advanceTime(current, safeNow) : current;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (highlightedFindEffects.length === 0) return;
    const timer = window.setTimeout(() => setHighlightedFindEffects([]), 4_000);
    return () => window.clearTimeout(timer);
  }, [highlightedFindEffects]);

  useEffect(() => {
    if (eventMessage === null) return;
    const timer = window.setTimeout(() => setEventMessage(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [eventMessage]);

  useEffect(() => {
    if (!signalwerkOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSignalwerkOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [signalwerkOpen]);

  useEffect(() => {
    const host = mapHostRef.current;
    if (host === null || !bootstrap.ok) {
      if (!bootstrap.ok) {
        setErrorMessage(bootstrap.error);
        setViewState('error');
      }
      return;
    }

    let disposed = false;
    let renderer: MountedHexWorld | undefined;
    const firstWorld = worldForRenderer(bootstrap.state);

    setViewState('loading');
    void mountHexWorld(host, firstWorld, {
      selectedTileKey: null,
      roadTileKeys: bootstrap.state.roadTileKeys,
      roadPreviewTileKeys: [],
      buildings: bootstrap.state.buildings
        .filter((building) => building.type !== 'survey-tent' && building.type !== 'workshop')
        .map((building) => ({
          tileKey: building.tileKey,
          type: building.type,
          state: building.status === 'constructing' ? 'construction' : 'complete',
        })),
      findEffects: [],
      wayfinder: bootstrap.state.units[0] === undefined
        ? null
        : {
            tileKey: bootstrap.state.units[0].tileKey,
            state: bootstrap.state.units[0].status,
          },
      surveyTargetTileKey: null,
      surveyTent: (() => {
        const initialTent = bootstrap.state.buildings.find((building) => building.type === 'survey-tent');
        return initialTent === undefined
          ? null
          : { state: initialTent.status === 'constructing' ? 'construction' : 'complete' };
      })(),
      relayDiscoveryHighlight: hasPrologueEvent(bootstrap.state, 'relay_discovered'),
      onHexSelect: handleHexSelect,
    })
      .then((mountedRenderer) => {
        if (disposed) {
          mountedRenderer.destroy();
          return;
        }
        renderer = mountedRenderer;
        rendererRef.current = mountedRenderer;
        const latest = latestRenderRef.current;
        if (latest !== undefined) mountedRenderer.update(latest.world, latest.view);
        setViewState('ready');
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setErrorMessage(
          error instanceof Error ? error.message : 'Die Kartenansicht konnte nicht geladen werden.',
        );
        setViewState('error');
      });

    return () => {
      disposed = true;
      rendererRef.current = undefined;
      renderer?.destroy();
    };
  }, [bootstrap, handleHexSelect]);

  useEffect(() => {
    if (effectiveWorld !== null) rendererRef.current?.update(effectiveWorld, rendererView);
  }, [effectiveWorld, rendererView]);

  const confirmRoad = useCallback(() => {
    if (gameState === null || selectedTile === null) return;
    const relayWasDiscovered = hasPrologueEvent(gameState, 'relay_discovered');
    const previousFinds = new Set(gameState.claimedSurfaceFindTileKeys);
    const result = buildRoad(gameState, selectedTile.coord);
    if (!result.ok) return;
    const relayJustDiscovered =
      !relayWasDiscovered && hasPrologueEvent(result.state, 'relay_discovered');
    const newFindKeys = result.state.claimedSurfaceFindTileKeys.filter((key) => !previousFinds.has(key));
    setGameState(result.state);
    setSelectedTile(null);
    if (newFindKeys.length > 0) {
      const effects: FindEffectVisual[] = [];
      let foundWood = 0;
      let foundStone = 0;
      for (const key of newFindKeys) {
        const stoneFind = gameState.world.surfaceFinds.find(
          (find) => find.resourceType === 'stone' && find.tileKey === key,
        );
        if (stoneFind !== undefined) {
          effects.push({ tileKey: key, resource: 'stone' });
          foundStone += stoneFind.amount;
          continue;
        }
        effects.push({ tileKey: key, resource: 'wood' });
        foundWood += FOREST_SURFACE_WOOD;
      }
      setHighlightedFindEffects(effects);
      const rewards = [
        foundWood > 0 ? `+${foundWood} Holz` : null,
        foundStone > 0 ? `+${foundStone} Stein` : null,
      ].filter((reward): reward is string => reward !== null);
      const findLabel = foundWood > 0 && foundStone > 0
        ? 'Funde geborgen'
        : foundStone > 0
          ? 'Steinfund geborgen'
          : 'Fallholz geborgen';
      setEventMessage(
        relayJustDiscovered
          ? `Relais entdeckt · ${rewards.join(' · ')}`
          : `${findLabel} · ${rewards.join(' · ')}`,
      );
    } else if (relayJustDiscovered) {
      setEventMessage('Relais entdeckt · Das tote Signal liegt frei');
    }
  }, [gameState, selectedTile]);

  const confirmBuilding = useCallback(() => {
    if (gameState === null || selectedTile === null || buildingPlan === null) return;
    const result =
      buildingPlan.type === 'lumber-camp'
        ? startLumberCamp(gameState, selectedTile.coord, commandNowMs)
        : startQuarry(gameState, selectedTile.coord, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage(`${buildingPlan.name} beauftragt · Fertigstellung in 10:00`);
  }, [buildingPlan, commandNowMs, gameState, selectedTile]);

  const confirmTraining = useCallback(() => {
    if (gameState === null) return;
    const result = startPathfinderTraining(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Wegfinder in Ausbildung · Bereit in 10:00');
  }, [commandNowMs, gameState]);

  const confirmMovement = useCallback(() => {
    if (gameState === null || selectedTile === null) return;
    const result = movePathfinder(gameState, selectedTile.coord, commandNowMs);
    setGameState(result.state);
    if (result.ok) {
      setEventMessage(`Wegfinder erreicht ${selectedTile.coord.q}, ${selectedTile.coord.r}`);
      setSelectedTile(null);
    }
  }, [commandNowMs, gameState, selectedTile]);

  const confirmSurvey = useCallback(() => {
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
  }, [commandNowMs, gameState, selectedTile]);

  const confirmSurveyTent = useCallback(() => {
    if (gameState === null) return;
    const result = startSurveyTent(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Vermesserzelt beauftragt · Fertigstellung in 10:00');
  }, [commandNowMs, gameState]);

  const confirmWorkshop = useCallback(() => {
    if (gameState === null) return;
    const result = startWorkshop(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Werkstatt beauftragt · Fertigstellung in 20:00');
  }, [commandNowMs, gameState]);

  const confirmRelayRepair = useCallback(() => {
    if (gameState === null) return;
    const result = startRelayRepair(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Resonanzkern installiert · Relais bereit in 30:00');
  }, [commandNowMs, gameState]);

  const rotateRune = useCallback((index: number) => {
    if (gameState === null) return;
    const wasSolved = gameState.signalwerk.solved;
    const result = rotateSignalwerkRune(gameState, index);
    setGameState(result.state);
    if (result.ok && !wasSolved && result.state.signalwerk.solved) {
      setEventMessage('Signalwerk gelöst · Resonanzkern geborgen');
    }
  }, [gameState]);

  const cancelSelection = useCallback(() => setSelectedTile(null), []);

  const generatorVersion = gameState?.world.generatorVersion ?? 'unbekannt';
  const roadsBuilt = gameState?.roadTileKeys.length ?? 0;
  const chapterProgress = Math.min(roadsBuilt, CHAPTER_ONE_ROAD_TARGET);
  const chapterComplete = chapterProgress === CHAPTER_ONE_ROAD_TARGET;
  const hasLumberCamp = gameState?.buildings.some((building) => building.type === 'lumber-camp') ?? false;
  const stoneProductionObserved = gameState?.prologue.stoneProductionObserved ?? false;
  const surveysCompleted = gameState?.prologue.pathfinderSurveysCompleted ?? 0;
  const chapterThreeComplete = gameState === null ? false : hasCompletedChapter(gameState, 3);
  const chapterFourComplete = gameState === null ? false : hasCompletedChapter(gameState, 4);
  const chapterFiveComplete = gameState === null ? false : hasCompletedChapter(gameState, 5);
  const chapterSixComplete = gameState === null ? false : hasCompletedChapter(gameState, 6);
  const surveyTentActive = surveyTent?.status === 'active';
  const workshopActive = workshop?.status === 'active';
  const relayVisible = gameState?.visibleTileKeys.includes(gameState.world.relaySite.tileKey) ?? false;
  const prologueChapter = !chapterThreeComplete ? 3 : !chapterFourComplete ? 4 : !chapterFiveComplete ? 5 : 6;
  const chapterNumber = !chapterComplete ? 1 : !hasLumberCamp ? 2 : prologueChapter;
  const chapterName = chapterNumber === 1
    ? 'Gründungsring'
    : chapterNumber === 2
      ? 'Waldlinie'
      : chapterNumber === 3
        ? 'Steinlinie'
        : chapterNumber === 4
          ? 'Weggabel'
          : chapterNumber === 5
            ? 'Totes Signal'
            : 'Resonanzkern';
  const missionTitle = chapterNumber === 1
    ? 'Ein Weg ins Unbekannte'
    : chapterNumber === 2
      ? 'Die Waldlinie'
      : chapterNumber === 3
        ? 'Stein und Sicht'
        : chapterNumber === 4
          ? 'Die Weggabel'
          : chapterFiveComplete
            ? chapterSixComplete
              ? 'Das Relais lebt'
              : signalwerkSolved
                ? 'Der Resonanzkern'
              : 'Das Signalwerk'
            : 'Das tote Signal';
  const missionDescription = chapterNumber === 1
    ? 'Wählt ein sichtbares Feld neben dem Dorf oder einer Straße. Jede Straße öffnet den Nebel entlang eures Weges.'
    : chapterNumber === 2
      ? 'Verbindet ein Waldfeld mit eurem Straßennetz und errichtet das erste Holzfällerlager.'
      : chapterNumber === 3
        ? 'Sichert die erste Steinproduktion und beweist den Wegfinder mit einer einzelnen Vermessung.'
        : chapterNumber === 4
          ? 'Baut das Straßennetz auf acht Felder aus und aktiviert das Vermesserzelt.'
          : chapterFiveComplete
            ? chapterSixComplete
              ? 'Der Resonanzkern arbeitet dauerhaft im reparierten Relais. Das erste Fernsignal folgt in Kapitel 7.'
              : signalwerkSolved
                ? 'Errichtet die Werkstatt, installiert den einzigartigen Kern und repariert anschließend das Relais.'
              : 'Wählt das entdeckte Relais und richtet im Signalwerk eine durchgehende Energieverbindung ein.'
            : 'Folgt Straße und Wegfinder tiefer in den Nebel, bis die verlassene Relaisstation sichtbar wird.';
  const missionObjective = chapterNumber === 1
    ? 'Zwei Straßenfelder errichten'
    : chapterNumber === 2
      ? 'Holzfällerlager beauftragen'
      : chapterNumber === 3
        ? !stoneProductionObserved
          ? 'Erste Steinproduktion erhalten'
          : 'Ein Nebelhex vermessen'
        : chapterNumber === 4
          ? roadsBuilt < 8
            ? 'Acht Straßenfelder verbinden'
            : 'Vermesserzelt aktivieren'
          : chapterFiveComplete
            ? !signalwerkSolved
              ? 'Signalwerk lösen'
              : workshop === undefined
                ? 'Werkstatt errichten'
                : workshop.status === 'constructing'
                  ? 'Werkstatt fertigstellen'
                  : relayStatus === 'dormant'
                    ? 'Resonanzkern installieren und Relais reparieren'
                    : relayStatus === 'repairing'
                      ? 'Relaisreparatur abschließen'
                      : 'Relais wiederhergestellt'
            : 'Verlassenes Relais aufdecken';
  const chapterSixProgress = Number(signalwerkSolved) + Number(workshopActive) + Number(relayStatus === 'active');
  const missionProgress = chapterNumber === 1
    ? `${chapterProgress} / ${CHAPTER_ONE_ROAD_TARGET}`
    : chapterNumber === 2
      ? '0 / 1'
      : chapterNumber === 3
        ? `${Number(stoneProductionObserved) + Number(surveysCompleted >= 1)} / 2`
        : chapterNumber === 4
          ? roadsBuilt < 8
            ? `${Math.min(roadsBuilt, 8)} / 8`
            : `${surveyTentActive ? 1 : 0} / 1`
          : chapterFiveComplete
            ? `${chapterSixProgress} / 3`
            : `${relayDiscovered && relayVisible ? 1 : 0} / 1`;
  const missionComplete = chapterNumber === 6 && chapterSixComplete;
  const missionNote = chapterNumber === 1
    ? 'Straßen kosten 1 Holz und decken angrenzende Felder auf.'
    : chapterNumber === 2
      ? 'Das Holzfällerlager kostet 4 Holz und 1 Stein.'
      : chapterNumber === 3
        ? `Steinproduktion ${stoneProductionObserved ? '✓' : '◇'} · Vermessungen ${Math.min(surveysCompleted, 1)} / 1`
        : chapterNumber === 4
          ? `Straßen ${Math.min(roadsBuilt, 8)} / 8 · Vermesserzelt ${surveyTentActive ? '✓' : '◇'}`
          : chapterFiveComplete
            ? chapterSixComplete
              ? 'Kern installiert · Relais aktiv · Kapitel 7 wartet auf den Richtungsimpuls.'
              : signalwerkSolved
                ? 'Werkstatt: 6 Holz, 4 Stein, 20 Min. · Reparatur: 5 Holz, 6 Stein, 30 Min.'
              : 'Das 5×5-Raster bleibt beim Schließen und nach einem Reload unverändert erhalten.'
            : 'Das Relais wird erst sichtbar, wenn sein Hex durch Straße oder Vermessung aufgedeckt wurde.';

  const buildingRemainingMs =
    selectedBuilding === undefined
      ? 0
      : selectedBuilding.status === 'constructing'
        ? selectedBuilding.completesAtMs - commandNowMs
        : selectedBuilding.lastProductionAtMs + WORLD_PULSE_MS - commandNowMs;
  const constructionProgress =
    selectedBuilding?.status === 'constructing'
      ? Math.min(
          1,
          Math.max(
            0,
            (commandNowMs - selectedBuilding.startedAtMs) /
              (selectedBuilding.completesAtMs - selectedBuilding.startedAtMs),
          ),
        )
      : 1;
  const selectedBuildingName = selectedBuilding?.type === 'quarry' ? 'Steinbruch' : 'Holzfällerlager';
  const selectedBuildingResource = selectedBuilding?.type === 'quarry' ? 'Stein' : 'Holz';
  const selectedBuildingYield =
    selectedBuilding?.type === 'quarry' ? QUARRY_STONE_PER_PULSE : LUMBER_CAMP_WOOD_PER_PULSE;
  const maxPathfinderCharges = surveyTent?.status === 'active'
    ? PATHFINDER_EXPANDED_MAX_CHARGES
    : PATHFINDER_BASE_MAX_CHARGES;
  const pathfinderRemainingMs = pathfinder === undefined
    ? 0
    : pathfinder.status === 'training'
      ? pathfinder.completesAtMs - commandNowMs
      : pathfinder.lastChargeAtMs + WORLD_PULSE_MS - commandNowMs;
  const pathfinderTrainingProgress = pathfinder?.status === 'training'
    ? Math.min(1, Math.max(0, (commandNowMs - pathfinder.startedAtMs) / (pathfinder.completesAtMs - pathfinder.startedAtMs)))
    : 1;
  const surveyTentRemainingMs = surveyTent?.status === 'constructing'
    ? surveyTent.completesAtMs - commandNowMs
    : 0;
  const surveyTentProgress = surveyTent?.status === 'constructing'
    ? Math.min(1, Math.max(0, (commandNowMs - surveyTent.startedAtMs) / (surveyTent.completesAtMs - surveyTent.startedAtMs)))
    : 1;
  const workshopRemainingMs = workshop?.status === 'constructing'
    ? workshop.completesAtMs - commandNowMs
    : 0;
  const workshopProgress = workshop?.status === 'constructing'
    ? Math.min(1, Math.max(0, (commandNowMs - workshop.startedAtMs) / WORKSHOP_BUILD_MS))
    : 1;
  const relayRemainingMs = gameState?.relay.status === 'repairing'
    ? gameState.relay.completesAtMs - commandNowMs
    : 0;
  const relayRepairProgress = gameState?.relay.status === 'repairing'
    ? Math.min(1, Math.max(0, (commandNowMs - gameState.relay.startedAtMs) / RELAY_REPAIR_MS))
    : gameState?.relay.status === 'active' ? 1 : 0;

  return (
    <main className="game-shell" aria-label="MERGEFORGE Weltansicht">
      <div
        ref={mapHostRef}
        className="map-host"
        role="img"
        aria-label="Isometrische Hexwelt rund um das Dorf Genesis"
        aria-busy={viewState === 'loading'}
      />
      <div className="map-atmosphere" aria-hidden="true" />

      <header className="top-bar">
        <a className="wordmark" href="/" aria-label="MERGEFORGE Startseite">
          <span className="wordmark-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>MERGEFORGE</span>
        </a>
        <div className="status-cluster" aria-label="Aktueller Dorfstatus">
          <span className="preview-label">Automatisch gespeichert</span>
          <span className="resource" aria-label={`Holz: ${gameState?.resources.wood ?? 0}`}>
            <i className="resource-dot wood" aria-hidden="true" /><span>Holz</span>
            <strong>{gameState?.resources.wood ?? 0}</strong>
          </span>
          <span className="resource" aria-label={`Stein: ${gameState?.resources.stone ?? 0}`}>
            <i className="resource-dot stone" aria-hidden="true" /><span>Stein</span>
            <strong>{gameState?.resources.stone ?? 0}</strong>
          </span>
          {pathfinder !== undefined && (
            <span className="resource charges" aria-label={`Expeditionsladungen: ${pathfinder.charges} von ${maxPathfinderCharges}`}>
              <i className="resource-dot charge" aria-hidden="true" /><span>Ladungen</span>
              <strong>{pathfinder.charges}/{maxPathfinderCharges}</strong>
            </span>
          )}
          {(gameState?.inventory.resonanceCore === 1 || gameState?.relay.coreInstalled) && (
            <span className="resource core" aria-label={`Resonanzkern: ${gameState?.relay.coreInstalled ? 'installiert' : 'im Inventar'}`}>
              <i className="resource-dot core" aria-hidden="true" /><span>Resonanzkern</span>
              <strong>{gameState?.relay.coreInstalled ? 'aktiv' : '1'}</strong>
            </span>
          )}
          <span className={`chapter-status ${missionComplete ? 'complete' : ''}`}>
            Kapitel {chapterNumber} · {chapterName}
          </span>
        </div>
      </header>

      <section className="mission-card" aria-labelledby="mission-title">
        <div className="mission-kicker"><span>Kapitel {chapterNumber}</span><span className="prototype-badge">Lokaler Prototyp</span></div>
        <h1 id="mission-title">{missionTitle}</h1>
        <p>{missionDescription}</p>
        <div className={`objective ${missionComplete ? 'complete' : ''}`} aria-label="Kapitelziel">
          <span className="objective-icon" aria-hidden="true">{missionComplete ? '✓' : '◇'}</span>
          <span><small>{missionComplete ? 'Kapitelziel erreicht' : 'Aktuelles Kapitelziel'}</small>{missionObjective}</span>
          <strong aria-live="polite">{missionProgress}</strong>
        </div>
        <p className="mission-note">{missionNote}</p>
      </section>

      {isRelaySelected && (
        <section className="build-card relay-card" aria-labelledby="relay-title">
          <div className="build-card-heading">
            <span className="road-symbol relay-symbol" aria-hidden="true">◉</span>
            <span><small>Signalrelais</small><h2 id="relay-title">{relayStatus === 'active' ? 'Relais wiederhergestellt' : relayStatus === 'repairing' ? 'Reparatur läuft' : signalwerkSolved ? 'Kern bereit' : 'Signalwerk zugänglich'}</h2></span>
          </div>
          <dl className="build-preview">
            <div><dt>Signalwerk</dt><dd>{signalwerkSolved ? 'Gelöst' : 'Unterbrochen'}</dd></div>
            <div><dt>Werkstatt</dt><dd>{workshopActive ? 'Aktiv' : 'Benötigt'}</dd></div>
            <div><dt>Kern</dt><dd>{gameState?.relay.coreInstalled ? 'Installiert' : `${gameState?.inventory.resonanceCore ?? 0} / 1`}</dd></div>
          </dl>
          {relayStatus === 'repairing' && (
            <>
              <div className="construction-progress" role="progressbar" aria-label="Relaisreparatur" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(relayRepairProgress * 100)}>
                <span style={{ width: `${relayRepairProgress * 100}%` }} />
              </div>
              <div className="building-timer"><span>Signal bereit in</span><strong aria-live="polite">{formatRemaining(relayRemainingMs)}</strong></div>
            </>
          )}
          <p className="build-explanation">
            {relayStatus === 'active'
              ? 'Der Resonanzkern bleibt sichtbar im Relais und versorgt den Mast dauerhaft.'
              : relayStatus === 'repairing'
                ? 'Der Kern ist eingesetzt. Die Werkstatt stellt die alten Signalpfade wieder her.'
                : signalwerkSolved
                  ? relayRepairPreview?.ok === false
                    ? relayRepairFailureCopy[relayRepairPreview.reason]
                    : 'Installiert den Kern und startet die einmalige Reparatur.'
                  : 'Dreht die Runenplatten, bis blaue Quelle und goldenes Ziel verbunden sind.'}
          </p>
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Schließen</button>
            {relayStatus === 'dormant' && (signalwerkSolved
              ? <button className="primary-action" type="button" disabled={relayRepairPreview?.ok !== true} onClick={confirmRelayRepair}>Kern installieren · Reparatur starten</button>
              : <button className="primary-action" type="button" onClick={() => setSignalwerkOpen(true)}>Signalwerk öffnen</button>)}
          </div>
        </section>
      )}

      {trainingPreview !== null && (
        <section className="build-card exploration-card" aria-labelledby="training-title">
          <div className="build-card-heading">
            <span className="road-symbol wayfinder-symbol" aria-hidden="true">✦</span>
            <span><small>Einheit ausbilden</small><h2 id="training-title">Wegfinder</h2></span>
          </div>
          {trainingPreview.ok ? (
            <>
              <dl className="build-preview">
                <div><dt>Kosten</dt><dd>{PATHFINDER_WOOD_COST} Holz · {PATHFINDER_STONE_COST} Stein</dd></div>
                <div><dt>Ausbildung</dt><dd>10:00</dd></div>
                <div><dt>Fähigkeit</dt><dd>1 Zielhex</dd></div>
              </dl>
              <p className="build-explanation">Der Wegfinder bewegt sich kostenlos auf eurem verbundenen Straßennetz.</p>
            </>
          ) : <p className="build-warning" role="status">{trainingFailureCopy[trainingPreview.reason]}</p>}
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Abbrechen</button>
            <button className="primary-action" type="button" disabled={!trainingPreview.ok} onClick={confirmTraining}>Ausbildung beginnen</button>
          </div>
        </section>
      )}

      {isVillageSelected && pathfinder?.status === 'training' && (
        <section className="build-card building-status-card exploration-card" aria-labelledby="training-status-title">
          <div className="build-card-heading">
            <span className="road-symbol wayfinder-symbol" aria-hidden="true">✦</span>
            <span><small>Wegfinder</small><h2 id="training-status-title">Ausbildung läuft</h2></span>
          </div>
          <div className="construction-progress" role="progressbar" aria-label="Ausbildungsfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pathfinderTrainingProgress * 100)}>
            <span style={{ width: `${pathfinderTrainingProgress * 100}%` }} />
          </div>
          <div className="building-timer"><span>Bereit in</span><strong aria-live="polite">{formatRemaining(pathfinderRemainingMs)}</strong></div>
          <p className="build-explanation">Nach Abschluss startet der Wegfinder am Dorf und kann sofort Straßenfelder erreichen.</p>
          <div className="build-actions single"><button className="secondary-action" type="button" onClick={cancelSelection}>Schließen</button></div>
        </section>
      )}

      {surveyTentPreview !== null && (
        <section className="build-card exploration-card" aria-labelledby="tent-title">
          <div className="build-card-heading">
            <span className="road-symbol tent-symbol" aria-hidden="true">△</span>
            <span><small>Dorfausbau</small><h2 id="tent-title">Vermesserzelt</h2></span>
          </div>
          {surveyTentPreview.ok ? (
            <>
              <dl className="build-preview">
                <div><dt>Kosten</dt><dd>{SURVEY_TENT_WOOD_COST} Holz · {SURVEY_TENT_STONE_COST} Stein</dd></div>
                <div><dt>Bauzeit</dt><dd>10:00</dd></div>
                <div><dt>Ladungen</dt><dd>{PATHFINDER_BASE_MAX_CHARGES} → {PATHFINDER_EXPANDED_MAX_CHARGES}</dd></div>
              </dl>
              <p className="build-explanation">Das Zelt verdoppelt den Speicher für Expeditionsladungen dauerhaft.</p>
            </>
          ) : <p className="build-warning" role="status">{surveyTentFailureCopy[surveyTentPreview.reason]}</p>}
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Abbrechen</button>
            <button className="primary-action" type="button" disabled={!surveyTentPreview.ok} onClick={confirmSurveyTent}>Zelt errichten</button>
          </div>
        </section>
      )}

      {isVillageSelected && surveyTent !== undefined && movementPreview === null && workshopPreview === null && workshop === undefined && (
        <section className="build-card building-status-card exploration-card" aria-labelledby="tent-status-title">
          <div className="build-card-heading">
            <span className="road-symbol tent-symbol" aria-hidden="true">△</span>
            <span><small>Vermesserzelt</small><h2 id="tent-status-title">{surveyTent.status === 'constructing' ? 'Bau läuft' : 'Expeditionslager aktiv'}</h2></span>
          </div>
          <div className="construction-progress" role="progressbar" aria-label="Zeltfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(surveyTentProgress * 100)}>
            <span style={{ width: `${surveyTentProgress * 100}%` }} />
          </div>
          <div className="building-timer">
            <span>{surveyTent.status === 'constructing' ? 'Fertig in' : 'Ladungsspeicher'}</span>
            <strong aria-live="polite">{surveyTent.status === 'constructing' ? formatRemaining(surveyTentRemainingMs) : `${PATHFINDER_EXPANDED_MAX_CHARGES} max.`}</strong>
          </div>
          <p className="build-explanation">{surveyTent.status === 'constructing' ? 'Nach Abschluss steigt das Ladungsmaximum von 6 auf 12.' : 'Der Wegfinder kann bis zu 12 Vermessungsaktionen speichern.'}</p>
          <div className="build-actions single"><button className="secondary-action" type="button" onClick={cancelSelection}>Schließen</button></div>
        </section>
      )}

      {workshopPreview !== null && (
        <section className="build-card exploration-card workshop-card" aria-labelledby="workshop-title">
          <div className="build-card-heading">
            <span className="road-symbol workshop-symbol" aria-hidden="true">⚒</span>
            <span><small>Dorfausbau</small><h2 id="workshop-title">Relaiswerkstatt</h2></span>
          </div>
          {workshopPreview.ok ? (
            <>
              <dl className="build-preview">
                <div><dt>Kosten</dt><dd>{WORKSHOP_WOOD_COST} Holz · {WORKSHOP_STONE_COST} Stein</dd></div>
                <div><dt>Bauzeit</dt><dd>20:00</dd></div>
                <div><dt>Funktion</dt><dd>Relais reparieren</dd></div>
              </dl>
              <p className="build-explanation">Die Werkstatt ist der einzige Ort, an dem der Resonanzkern sicher in das alte Relais eingesetzt werden kann.</p>
            </>
          ) : <p className="build-warning" role="status">{workshopFailureCopy[workshopPreview.reason]}</p>}
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Abbrechen</button>
            <button className="primary-action" type="button" disabled={!workshopPreview.ok} onClick={confirmWorkshop}>Werkstatt errichten</button>
          </div>
        </section>
      )}

      {isVillageSelected && workshop !== undefined && (
        <section className="build-card building-status-card exploration-card workshop-card" aria-labelledby="workshop-status-title">
          <div className="build-card-heading">
            <span className="road-symbol workshop-symbol" aria-hidden="true">⚒</span>
            <span><small>Relaiswerkstatt</small><h2 id="workshop-status-title">{workshop.status === 'constructing' ? 'Bau läuft' : 'Werkstatt aktiv'}</h2></span>
          </div>
          <div className="construction-progress" role="progressbar" aria-label="Werkstattfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(workshopProgress * 100)}>
            <span style={{ width: `${workshopProgress * 100}%` }} />
          </div>
          <div className="building-timer"><span>{workshop.status === 'constructing' ? 'Fertig in' : 'Status'}</span><strong aria-live="polite">{workshop.status === 'constructing' ? formatRemaining(workshopRemainingMs) : 'Bereit'}</strong></div>
          <p className="build-explanation">{workshop.status === 'constructing' ? 'Nach Abschluss kann der Kern am entdeckten Relais installiert werden.' : 'Wählt das Relais, um den Resonanzkern zu installieren und die Reparatur zu starten.'}</p>
          <div className="build-actions single"><button className="secondary-action" type="button" onClick={cancelSelection}>Schließen</button></div>
        </section>
      )}

      {surveyPreview !== null && selectedTile !== null && (
        <section className="build-card exploration-card" aria-labelledby="survey-title">
          <div className="build-card-heading">
            <span className="road-symbol survey-symbol" aria-hidden="true">⌖</span>
            <span><small>Nebel untersuchen</small><h2 id="survey-title">Hex {selectedTile.coord.q}, {selectedTile.coord.r} vermessen</h2></span>
          </div>
          {surveyPreview.ok ? (
            <>
              <dl className="build-preview">
                <div><dt>Kosten</dt><dd>1 Ladung</dd></div>
                <div><dt>Aufdeckung</dt><dd>genau 1 Hex</dd></div>
                <div><dt>Verbleibend</dt><dd>{Math.max(0, (pathfinder?.charges ?? 0) - 1)} / {maxPathfinderCharges}</dd></div>
              </dl>
              <p className="build-explanation">Vermessung schafft Sicht, aber weder Besitz noch eine Straßenverbindung.</p>
            </>
          ) : <p className="build-warning" role="status">{surveyFailureCopy[surveyPreview.reason]}</p>}
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Abbrechen</button>
            <button className="primary-action" type="button" disabled={!surveyPreview.ok} onClick={confirmSurvey}>Jetzt vermessen</button>
          </div>
        </section>
      )}

      {movementPreview !== null && selectedTile !== null && (
        <section className="build-card exploration-card" aria-labelledby="movement-title">
          <div className="build-card-heading">
            <span className="road-symbol wayfinder-symbol" aria-hidden="true">✦</span>
            <span><small>Straßenbewegung</small><h2 id="movement-title">Wegfinder nach {selectedTile.coord.q}, {selectedTile.coord.r}</h2></span>
          </div>
          {movementPreview.ok ? (
            <>
              <dl className="build-preview">
                <div><dt>Kosten</dt><dd>kostenlos</dd></div>
                <div><dt>Ankunft</dt><dd>sofort</dd></div>
                <div><dt>Ladungen</dt><dd>{pathfinder?.charges ?? 0} / {maxPathfinderCharges}</dd></div>
              </dl>
              <p className="build-explanation">Bewegung verbraucht keine Expeditionsladung.</p>
            </>
          ) : <p className="build-warning" role="status">{movementFailureCopy[movementPreview.reason]}</p>}
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Abbrechen</button>
            <button className="primary-action" type="button" disabled={!movementPreview.ok} onClick={confirmMovement}>Wegfinder bewegen</button>
          </div>
        </section>
      )}

      {pathfinder?.status === 'active' && selectedTile?.key === pathfinder.tileKey && !isVillageSelected && selectedBuilding === undefined && buildingPlan === null && (
        <section className="build-card exploration-card" aria-labelledby="wayfinder-title">
          <div className="build-card-heading">
            <span className="road-symbol wayfinder-symbol" aria-hidden="true">✦</span>
            <span><small>Einheit bereit</small><h2 id="wayfinder-title">Wegfinder am Straßenkopf</h2></span>
          </div>
          <dl className="build-preview">
            <div><dt>Ladungen</dt><dd>{pathfinder.charges} / {maxPathfinderCharges}</dd></div>
            <div><dt>Vermessung</dt><dd>1 Zielhex</dd></div>
            <div><dt>Nächste Ladung</dt><dd>{pathfinder.charges >= maxPathfinderCharges ? 'Speicher voll' : formatRemaining(pathfinderRemainingMs)}</dd></div>
          </dl>
          <p className="build-explanation">Wählt ein einzelnes Nebelhex in Vermessungsreichweite des Straßenkopfs.</p>
          <div className="build-actions single"><button className="secondary-action" type="button" onClick={cancelSelection}>Schließen</button></div>
        </section>
      )}

      {selectedBuilding !== undefined && (
        <section className="build-card building-status-card" aria-labelledby="building-title">
          <div className="build-card-heading">
            <span className={`road-symbol ${selectedBuilding.type === 'quarry' ? 'quarry-symbol' : 'camp-symbol'}`} aria-hidden="true">
              {selectedBuilding.type === 'quarry' ? '◆' : '♜'}
            </span>
            <span><small>{selectedBuildingName}</small><h2 id="building-title">{selectedBuilding.status === 'constructing' ? 'Bau läuft' : 'Produktion aktiv'}</h2></span>
          </div>
          <div
            className="construction-progress"
            role="progressbar"
            aria-label="Baufortschritt"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(constructionProgress * 100)}
          ><span style={{ width: `${constructionProgress * 100}%` }} /></div>
          <div className="building-timer">
            <span>{selectedBuilding.status === 'constructing' ? 'Fertig in' : `Nächste +${selectedBuildingYield} ${selectedBuildingResource} in`}</span>
            <strong aria-live="polite">{formatRemaining(buildingRemainingMs)}</strong>
          </div>
          <p className="build-explanation">
            {selectedBuilding.status === 'constructing'
              ? `Am Bauende wird ${selectedBuildingName === 'Steinbruch' ? 'der' : 'das'} ${selectedBuildingName} aktiv und liefert sofort ${selectedBuildingYield} ${selectedBuildingResource}.`
              : `${selectedBuildingName} produziert automatisch ${selectedBuildingYield} ${selectedBuildingResource} je 10-Minuten-Welttakt.`}
          </p>
          <div className="build-actions single"><button className="secondary-action" type="button" onClick={cancelSelection}>Schließen</button></div>
        </section>
      )}

      {selectedBuilding === undefined && buildingPlan !== null && (
        <section className="build-card" aria-labelledby="build-title">
          <div className="build-card-heading">
            <span className={`road-symbol ${buildingPlan.type === 'quarry' ? 'quarry-symbol' : 'camp-symbol'}`} aria-hidden="true">{buildingPlan.icon}</span>
            <span><small>Gebäude planen</small><h2 id="build-title">{buildingPlan.name}</h2></span>
          </div>
          {buildingPlan.result.ok ? (
            <>
              <dl className="build-preview">
                <div><dt>Kosten</dt><dd>{buildingPlan.woodCost} Holz · {buildingPlan.stoneCost} Stein</dd></div>
                <div><dt>Bauzeit</dt><dd>10:00</dd></div>
                <div><dt>Ertrag</dt><dd>{buildingPlan.output}</dd></div>
              </dl>
              <p className="build-explanation">Nur ein Gebäude kann gleichzeitig im Bau sein.</p>
            </>
          ) : (
            <p className="build-warning" role="status">
              {buildingPlan.type === 'quarry'
                ? quarryFailureCopy[buildingPlan.result.reason]
                : lumberFailureCopy[buildingPlan.result.reason]}
            </p>
          )}
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Abbrechen</button>
            <button className="primary-action" type="button" disabled={!buildingPlan.result.ok} onClick={confirmBuilding}>{buildingPlan.action}</button>
          </div>
        </section>
      )}

      {selectedBuilding === undefined && buildingPlan === null && movementPreview === null && selectedTile !== null && roadPreview !== null && (
        <section className="build-card" aria-labelledby="build-title">
          <div className="build-card-heading">
            <span className="road-symbol" aria-hidden="true">⌁</span>
            <span><small>Straße planen</small><h2 id="build-title">Weg nach {selectedTile.coord.q}, {selectedTile.coord.r}</h2></span>
          </div>
          {roadPreview.ok ? (
            <>
              <dl className="build-preview">
                <div><dt>Kosten</dt><dd><i className="resource-dot wood" aria-hidden="true" /> {ROAD_WOOD_COST} Holz</dd></div>
                <div><dt>Aufdeckung</dt><dd>{newlyRevealedCount} {newlyRevealedCount === 1 ? 'neues Feld' : 'neue Felder'}</dd></div>
                <div><dt>Bauzeit</dt><dd>Sofort</dd></div>
              </dl>
              <p className="build-explanation">Oberflächenfunde auf neu entdeckten Feldern werden direkt eingelagert.</p>
            </>
          ) : <p className="build-warning" role="status">{roadFailureCopy[roadPreview.reason]}</p>}
          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelSelection}>Abbrechen</button>
            <button className="primary-action" type="button" disabled={!roadPreview.ok} onClick={confirmRoad}>Straße bauen</button>
          </div>
        </section>
      )}

      {systemNotice !== null && (
        <section className="system-notice" role="status">
          <span>{systemNotice}</span>
          <button type="button" aria-label="Hinweis schließen" onClick={() => setSystemNotice(null)}>×</button>
        </section>
      )}
      {eventMessage !== null && <div className="event-toast" role="status">{eventMessage}</div>}

      {signalwerkOpen && gameState !== null && signalwerkPuzzle !== null && (
        <section className="signalwerk-backdrop" role="dialog" aria-modal="true" aria-labelledby="signalwerk-title">
          <div className="signalwerk-panel">
            <header className="signalwerk-header">
              <div>
                <span className="signalwerk-kicker">Relaismodul · 5×5</span>
                <h2 id="signalwerk-title">Signalwerk</h2>
                <p>{signalwerkSolved ? 'Energiefluss stabil. Der einzigartige Kern wurde geborgen.' : 'Jede Platte dreht sich um 90°. Verbindet die blaue Quelle links mit dem goldenen Ziel rechts.'}</p>
              </div>
              <button className="signalwerk-close" type="button" aria-label="Signalwerk schließen" onClick={() => setSignalwerkOpen(false)}>×</button>
            </header>

            <div className={`signalwerk-stage ${signalwerkSolved ? 'solved' : ''}`}>
              <span className="signal-terminal source-terminal" aria-hidden="true"><i />Quelle</span>
              <div className="signalwerk-grid" role="grid" aria-label="Signalwerk Runenraster">
                {signalwerkPuzzle.tiles.map((tile, index) => {
                  const rotation = gameState.signalwerk.rotations[index] ?? 0;
                  const connections = tileConnections(tile, rotation);
                  const isSource = index === signalwerkPuzzle.sourceIndex;
                  const isTarget = index === signalwerkPuzzle.targetIndex;
                  const connectionLabel = connections.map((direction) => directionCopy[direction]).join(', ');
                  return (
                    <button
                      className={`signal-rune ${isSource ? 'source-rune' : ''} ${isTarget ? 'target-rune' : ''}`}
                      key={index}
                      type="button"
                      role="gridcell"
                      aria-label={`Rune ${index + 1}${isSource ? ', Quelle' : ''}${isTarget ? ', Ziel' : ''}, ${rotation * 90} Grad, offen nach ${connectionLabel}`}
                      disabled={signalwerkSolved}
                      onClick={() => rotateRune(index)}
                    >
                      <span className="rune-lines" aria-hidden="true">
                        {connections.map((direction) => <i className={`rune-line ${direction}`} key={direction} />)}
                        <b />
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="signal-terminal target-terminal" aria-hidden="true">Ziel<i /></span>
            </div>

            <footer className="signalwerk-footer">
              {signalwerkSolved ? (
                <div className="core-result" role="status">
                  <span className="core-glyph" aria-hidden="true">◈</span>
                  <span><small>{gameState.relay.coreInstalled ? 'Relais' : 'Inventar'}</small><strong>{gameState.relay.coreInstalled ? 'Resonanzkern · installiert' : '1 Resonanzkern · bereit'}</strong></span>
                </div>
              ) : (
                <p>Fortschritt wird nach jeder Drehung automatisch gespeichert. Schließen setzt das Raster nicht zurück.</p>
              )}
              <button className="secondary-action signalwerk-done" type="button" onClick={() => setSignalwerkOpen(false)}>Zurück zur Karte</button>
            </footer>
          </div>
        </section>
      )}

      <aside className="world-badge" aria-label="Weltdaten">
        <span className="signal-dot" aria-hidden="true" />
        <span><small>Genesis-Sektor</small>{WORLD_SEED}</span>
        <span className="version">Gen {generatorVersion}</span>
      </aside>
      <aside className="camera-hints" aria-label="Kartensteuerung">
        <span><kbd>Klick</kbd> Feld wählen</span><span><kbd>Drag</kbd> Karte bewegen</span><span><kbd>Scroll</kbd> Zoomen</span>
        <span className="touch-hint">Tippen zum Wählen · Ziehen und spreizen</span>
      </aside>

      {viewState !== 'ready' && (
        <section className={`view-message ${viewState}`} role={viewState === 'error' ? 'alert' : 'status'}>
          {viewState === 'loading' ? (
            <><span className="loading-rune" aria-hidden="true" /><strong>Genesis wird kartiert</strong><span>Hex für Hex entsteht eure Welt …</span></>
          ) : (
            <><strong>Die Welt bleibt im Nebel</strong><span>{errorMessage}</span><button type="button" onClick={() => window.location.reload()}>Ansicht neu laden</button></>
          )}
        </section>
      )}
    </main>
  );
}
