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
  WORLD_PULSE_MS,
  advanceTime,
  buildRoad,
  createInitialGameState,
  movePathfinder,
  startPathfinderTraining,
  startLumberCamp,
  startQuarry,
  startSurveyTent,
  surveyWithPathfinder,
  type BuildRoadRejection,
  type GameState,
  type MovePathfinderRejection,
  type StartLumberCampRejection,
  type StartPathfinderTrainingRejection,
  type StartQuarryRejection,
  type StartSurveyTentRejection,
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

function nextSettlementAt(state: GameState): number {
  const surveyTent = state.buildings.find((building) => building.type === 'survey-tent');
  const maxCharges = surveyTent?.status === 'active'
    ? PATHFINDER_EXPANDED_MAX_CHARGES
    : PATHFINDER_BASE_MAX_CHARGES;
  const buildingEvents = state.buildings.map((building) => {
    if (building.status === 'constructing') return building.completesAtMs;
    return building.type === 'survey-tent'
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
  return Math.min(...buildingEvents, ...unitEvents, Number.POSITIVE_INFINITY);
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
      return building?.type === 'survey-tent' ? undefined : building;
    },
    [gameState?.buildings, selectedTile?.key],
  );
  const pathfinder = gameState?.units.find((unit) => unit.type === 'pathfinder');
  const surveyTent = gameState?.buildings.find((building) => building.type === 'survey-tent');
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
      || surveyPreview !== null
    ) {
      return null;
    }
    return buildRoad(gameState, selectedTile.coord);
  }, [gameState, isLumberCampSite, isQuarrySite, isVillageSelected, selectedBuilding, selectedTile, surveyPreview, surveyTentPreview, trainingPreview]);
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
    ) return null;
    const canBeDestination = selectedTile.key === villageTileKey
      || gameState.roadTileKeys.includes(selectedTile.key);
    return canBeDestination
      ? movePathfinder(gameState, selectedTile.coord, commandNowMs)
      : null;
  }, [buildingPlan, commandNowMs, gameState, pathfinder, selectedBuilding, selectedTile, surveyPreview, surveyTentPreview, trainingPreview, villageTileKey]);

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
          .filter((building) => building.type !== 'survey-tent')
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
    }),
    [gameState?.buildings, gameState?.roadTileKeys, highlightedFindEffects, pathfinder, roadPreview, selectedTile, surveyPreview, surveyTent],
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
        .filter((building) => building.type !== 'survey-tent')
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
    const previousFinds = new Set(gameState.claimedSurfaceFindTileKeys);
    const result = buildRoad(gameState, selectedTile.coord);
    if (!result.ok) return;
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
      setEventMessage(`${findLabel} · ${rewards.join(' · ')}`);
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
    const result = surveyWithPathfinder(gameState, selectedTile.coord, commandNowMs);
    setGameState(result.state);
    if (result.ok) {
      setEventMessage('Vermessung abgeschlossen · 1 Hex kartiert');
      setSelectedTile(null);
    }
  }, [commandNowMs, gameState, selectedTile]);

  const confirmSurveyTent = useCallback(() => {
    if (gameState === null) return;
    const result = startSurveyTent(gameState, commandNowMs);
    setGameState(result.state);
    if (result.ok) setEventMessage('Vermesserzelt beauftragt · Fertigstellung in 10:00');
  }, [commandNowMs, gameState]);

  const cancelSelection = useCallback(() => setSelectedTile(null), []);

  const generatorVersion = gameState?.world.generatorVersion ?? 'unbekannt';
  const roadsBuilt = gameState?.roadTileKeys.length ?? 0;
  const chapterProgress = Math.min(roadsBuilt, CHAPTER_ONE_ROAD_TARGET);
  const chapterComplete = chapterProgress === CHAPTER_ONE_ROAD_TARGET;
  const hasLumberCamp = gameState?.buildings.some((building) => building.type === 'lumber-camp') ?? false;
  const quarry = gameState?.buildings.find((building) => building.type === 'quarry');
  const quarryActive = quarry?.status === 'active';
  const pathfinderActive = pathfinder?.status === 'active';
  const chapterNumber = !chapterComplete ? 1 : hasLumberCamp ? 3 : 2;
  const chapterName = !chapterComplete ? 'Gründungsring' : hasLumberCamp ? 'Steinlinie' : 'Waldlinie';
  const missionTitle = !chapterComplete
    ? 'Ein Weg ins Unbekannte'
    : hasLumberCamp
      ? 'Die Ader im Fels'
      : 'Die Waldlinie';
  const missionDescription = !chapterComplete
    ? 'Wählt ein sichtbares Feld neben dem Dorf oder einer Straße. Jede Straße öffnet den Nebel entlang eures Weges.'
    : hasLumberCamp
      ? 'Folgt dem zweiten Straßenarm zum markierten Steinvorkommen und sichert die Versorgung mit einem Steinbruch.'
      : 'Verbindet ein Waldfeld mit eurem Straßennetz und errichtet das erste Holzfällerlager.';
  const missionObjective = !chapterComplete
    ? 'Zwei Straßenfelder errichten'
    : hasLumberCamp
      ? quarryActive
        ? pathfinderActive
          ? 'Wegfinder am Straßenkopf einsetzen'
          : 'Wegfinder ausbilden'
        : 'Steinbruch aktivieren'
      : 'Holzfällerlager beauftragen';
  const missionProgress = !chapterComplete
    ? `${chapterProgress} / ${CHAPTER_ONE_ROAD_TARGET}`
    : hasLumberCamp
      ? `${quarryActive && pathfinderActive ? 1 : 0} / 1`
      : '0 / 1';
  const missionComplete = false;

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
        <p className="mission-note">
          {!chapterComplete
            ? 'Straßen kosten 1 Holz und decken angrenzende Felder auf.'
            : hasLumberCamp
              ? quarryActive
                ? pathfinderActive
                  ? `Der Wegfinder ist bereit. Jede Vermessung kostet 1 Ladung; aktuell ${pathfinder?.charges ?? 0}/${maxPathfinderCharges}.`
                  : 'Wählt den Dorfkern und beginnt die 10-minütige Wegfinder-Ausbildung.'
                : 'Der Steinbruch kostet 3 Holz und 1 Stein und produziert 1 Stein je Welttakt.'
              : 'Das Holzfällerlager kostet 4 Holz und 1 Stein.'}
        </p>
      </section>

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

      {isVillageSelected && surveyTent !== undefined && movementPreview === null && (
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
