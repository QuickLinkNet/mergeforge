import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FOREST_SURFACE_WOOD,
  LUMBER_CAMP_STONE_COST,
  LUMBER_CAMP_WOOD_COST,
  LUMBER_CAMP_WOOD_PER_PULSE,
  QUARRY_STONE_COST,
  QUARRY_STONE_PER_PULSE,
  QUARRY_WOOD_COST,
  ROAD_WOOD_COST,
  WORLD_PULSE_MS,
  advanceTime,
  buildRoad,
  createInitialGameState,
  startLumberCamp,
  startQuarry,
  type BuildRoadRejection,
  type GameState,
  type StartLumberCampRejection,
  type StartQuarryRejection,
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
  if (state.buildings.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...state.buildings.map((building) =>
      building.status === 'constructing'
        ? building.completesAtMs
        : building.lastProductionAtMs + WORLD_PULSE_MS,
    ),
  );
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
    () => gameState?.buildings.find((building) => building.tileKey === selectedTile?.key),
    [gameState?.buildings, selectedTile?.key],
  );
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

  const roadPreview = useMemo(() => {
    if (
      gameState === null ||
      selectedTile === null ||
      isLumberCampSite ||
      isQuarrySite ||
      selectedBuilding !== undefined
    ) {
      return null;
    }
    return buildRoad(gameState, selectedTile.coord);
  }, [gameState, isLumberCampSite, isQuarrySite, selectedBuilding, selectedTile]);
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
        gameState?.buildings.map((building) => ({
          tileKey: building.tileKey,
          type: building.type,
          state: building.status === 'constructing' ? 'construction' : 'complete',
        })) ?? [],
      findEffects: highlightedFindEffects,
    }),
    [gameState?.buildings, gameState?.roadTileKeys, highlightedFindEffects, roadPreview, selectedTile],
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
      buildings: bootstrap.state.buildings.map((building) => ({
        tileKey: building.tileKey,
        type: building.type,
        state: building.status === 'constructing' ? 'construction' : 'complete',
      })),
      findEffects: [],
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

  const cancelSelection = useCallback(() => setSelectedTile(null), []);

  const generatorVersion = gameState?.world.generatorVersion ?? 'unbekannt';
  const roadsBuilt = gameState?.roadTileKeys.length ?? 0;
  const chapterProgress = Math.min(roadsBuilt, CHAPTER_ONE_ROAD_TARGET);
  const chapterComplete = chapterProgress === CHAPTER_ONE_ROAD_TARGET;
  const hasLumberCamp = gameState?.buildings.some((building) => building.type === 'lumber-camp') ?? false;
  const quarry = gameState?.buildings.find((building) => building.type === 'quarry');
  const quarryActive = quarry?.status === 'active';
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
      ? 'Steinbruch aktivieren'
      : 'Holzfällerlager beauftragen';
  const missionProgress = !chapterComplete
    ? `${chapterProgress} / ${CHAPTER_ONE_ROAD_TARGET}`
    : hasLumberCamp
      ? `${quarryActive ? 1 : 0} / 1`
      : '0 / 1';
  const missionComplete = !chapterComplete ? false : hasLumberCamp ? quarryActive : false;

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
                ? 'Die Steinversorgung läuft. Der Wegfinder folgt im nächsten Issue.'
                : 'Der Steinbruch kostet 3 Holz und 1 Stein und produziert 1 Stein je Welttakt.'
              : 'Das Holzfällerlager kostet 4 Holz und 1 Stein.'}
        </p>
      </section>

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

      {selectedBuilding === undefined && buildingPlan === null && selectedTile !== null && roadPreview !== null && (
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
