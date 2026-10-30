import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ROAD_WOOD_COST,
  buildRoad,
  createInitialGameState,
  type BuildRoadRejection,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import {
  mountHexWorld,
  type HexSelectionEvent,
  type HexWorldViewState,
  type MountedHexWorld,
} from '@mergeforge/renderer-pixi';
import { generateWorld } from '@mergeforge/worldgen';

const WORLD_SEED = 'mergeforge-genesis-001';
const WORLD_RADIUS = 7;
const CHAPTER_ONE_ROAD_TARGET = 2;

type ViewState = 'loading' | 'ready' | 'error';

const failureCopy: Readonly<Record<BuildRoadRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-visible': 'Dieses Feld liegt noch hinter dem Nebel.',
  'not-traversable': 'Auf diesem Gelände kann keine Straße entstehen.',
  'village-tile': 'Der Dorfkern ist bereits der Ausgangspunkt eures Straßennetzes.',
  'already-road': 'Auf diesem Feld liegt bereits eine Straße.',
  'not-connected': 'Die Straße muss am Dorf oder Straßennetz anschließen.',
  'insufficient-wood': 'Für diese Straße fehlt Holz.',
};

function worldForRenderer(state: GameState): WorldSnapshot {
  return { ...state.world, visibleTileKeys: state.visibleTileKeys };
}

export function App() {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MountedHexWorld | undefined>(undefined);
  const latestRenderRef = useRef<{
    world: WorldSnapshot;
    view: HexWorldViewState;
  } | undefined>(undefined);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedTile, setSelectedTile] = useState<HexSelectionEvent | null>(null);

  const worldResult = useMemo(() => {
    try {
      return { world: generateWorld({ seed: WORLD_SEED, radius: WORLD_RADIUS }) } as const;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Die Welt konnte nicht erzeugt werden.',
      } as const;
    }
  }, []);

  const initialGameState = useMemo(
    () => ('world' in worldResult ? createInitialGameState(worldResult.world) : null),
    [worldResult],
  );
  const [gameState, setGameState] = useState<GameState | null>(initialGameState);

  const roadPreview = useMemo(() => {
    if (gameState === null || selectedTile === null) return null;
    return buildRoad(gameState, selectedTile.coord);
  }, [gameState, selectedTile]);

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
    }),
    [gameState?.roadTileKeys, roadPreview, selectedTile],
  );

  if (effectiveWorld !== null) {
    latestRenderRef.current = { world: effectiveWorld, view: rendererView };
  }

  const handleHexSelect = useCallback((event: HexSelectionEvent) => {
    setSelectedTile(event);
  }, []);

  useEffect(() => {
    const host = mapHostRef.current;
    if (host === null || initialGameState === null) {
      if ('error' in worldResult) {
        setErrorMessage(worldResult.error);
        setViewState('error');
      }
      return;
    }

    let disposed = false;
    let renderer: MountedHexWorld | undefined;
    const firstWorld = worldForRenderer(initialGameState);

    setViewState('loading');
    void mountHexWorld(host, firstWorld, {
      selectedTileKey: null,
      roadTileKeys: initialGameState.roadTileKeys,
      roadPreviewTileKeys: [],
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
  }, [handleHexSelect, initialGameState, worldResult]);

  useEffect(() => {
    if (effectiveWorld !== null) rendererRef.current?.update(effectiveWorld, rendererView);
  }, [effectiveWorld, rendererView]);

  const confirmRoad = useCallback(() => {
    if (gameState === null || selectedTile === null) return;
    const result = buildRoad(gameState, selectedTile.coord);
    if (!result.ok) return;
    setGameState(result.state);
    setSelectedTile(null);
  }, [gameState, selectedTile]);

  const cancelRoad = useCallback(() => setSelectedTile(null), []);

  const generatorVersion = 'world' in worldResult ? worldResult.world.generatorVersion : 'unbekannt';
  const roadsBuilt = gameState?.roadTileKeys.length ?? 0;
  const chapterProgress = Math.min(roadsBuilt, CHAPTER_ONE_ROAD_TARGET);
  const chapterComplete = chapterProgress === CHAPTER_ONE_ROAD_TARGET;

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
          <span className="wordmark-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>MERGEFORGE</span>
        </a>

        <div className="status-cluster" aria-label="Aktueller Dorfstatus">
          <span className="preview-label">Lokaler Spielstand</span>
          <span className="resource" aria-label={`Holz: ${gameState?.resources.wood ?? 0}`}>
            <i className="resource-dot wood" aria-hidden="true" />
            <span>Holz</span>
            <strong>{gameState?.resources.wood ?? 0}</strong>
          </span>
          <span className="resource" aria-label={`Stein: ${gameState?.resources.stone ?? 0}`}>
            <i className="resource-dot stone" aria-hidden="true" />
            <span>Stein</span>
            <strong>{gameState?.resources.stone ?? 0}</strong>
          </span>
          <span className={`chapter-status ${chapterComplete ? 'complete' : ''}`}>
            Kapitel 1 · {chapterComplete ? 'Ziel erreicht' : 'Gründungsring'}
          </span>
        </div>
      </header>

      <section className="mission-card" aria-labelledby="mission-title">
        <div className="mission-kicker">
          <span>Erstes Ziel</span>
          <span className="prototype-badge">Lokaler Prototyp</span>
        </div>
        <h1 id="mission-title">Ein Weg ins Unbekannte</h1>
        <p>
          Wählt ein sichtbares Feld neben dem Dorf oder einer Straße. Jede neue Straße öffnet den
          Nebel entlang eures Weges.
        </p>
        <div className={`objective ${chapterComplete ? 'complete' : ''}`} aria-label="Kapitelziel">
          <span className="objective-icon" aria-hidden="true">{chapterComplete ? '✓' : '◇'}</span>
          <span>
            <small>{chapterComplete ? 'Kapitelziel erreicht' : 'Aktuelles Kapitelziel'}</small>
            Zwei Straßenfelder errichten
          </span>
          <strong aria-live="polite">{chapterProgress} / {CHAPTER_ONE_ROAD_TARGET}</strong>
        </div>
        <p className="mission-note">
          {chapterComplete
            ? 'Der Gründungsring steht. Die Waldlinie folgt in der nächsten Ausbaustufe.'
            : 'Straßen kosten 1 Holz und werden sofort fertiggestellt.'}
        </p>
      </section>

      {selectedTile !== null && roadPreview !== null && (
        <section className="build-card" aria-labelledby="build-title">
          <div className="build-card-heading">
            <span className="road-symbol" aria-hidden="true">⌁</span>
            <span>
              <small>Straße planen</small>
              <h2 id="build-title">Weg nach {selectedTile.coord.q}, {selectedTile.coord.r}</h2>
            </span>
          </div>

          {roadPreview.ok ? (
            <>
              <dl className="build-preview">
                <div>
                  <dt>Kosten</dt>
                  <dd><i className="resource-dot wood" aria-hidden="true" /> {ROAD_WOOD_COST} Holz</dd>
                </div>
                <div>
                  <dt>Aufdeckung</dt>
                  <dd>{newlyRevealedCount} {newlyRevealedCount === 1 ? 'neues Feld' : 'neue Felder'}</dd>
                </div>
                <div>
                  <dt>Bauzeit</dt>
                  <dd>Sofort</dd>
                </div>
              </dl>
              <p className="build-explanation">Die goldene Vorschau zeigt das neue Straßenfeld vor dem Bau.</p>
            </>
          ) : (
            <p className="build-warning" role="status">{failureCopy[roadPreview.reason]}</p>
          )}

          <div className="build-actions">
            <button className="secondary-action" type="button" onClick={cancelRoad}>Abbrechen</button>
            <button
              className="primary-action"
              type="button"
              disabled={!roadPreview.ok}
              onClick={confirmRoad}
            >
              Straße bauen
            </button>
          </div>
        </section>
      )}

      <aside className="world-badge" aria-label="Weltdaten">
        <span className="signal-dot" aria-hidden="true" />
        <span>
          <small>Genesis-Sektor</small>
          {WORLD_SEED}
        </span>
        <span className="version">Gen {generatorVersion}</span>
      </aside>

      <aside className="camera-hints" aria-label="Kartensteuerung">
        <span><kbd>Klick</kbd> Feld wählen</span>
        <span><kbd>Drag</kbd> Karte bewegen</span>
        <span><kbd>Scroll</kbd> Zoomen</span>
        <span className="touch-hint">Tippen zum Wählen · Ziehen und spreizen</span>
      </aside>

      {viewState !== 'ready' && (
        <section className={`view-message ${viewState}`} role={viewState === 'error' ? 'alert' : 'status'}>
          {viewState === 'loading' ? (
            <>
              <span className="loading-rune" aria-hidden="true" />
              <strong>Genesis wird kartiert</strong>
              <span>Hex für Hex entsteht eure Welt …</span>
            </>
          ) : (
            <>
              <strong>Die Welt bleibt im Nebel</strong>
              <span>{errorMessage}</span>
              <button type="button" onClick={() => window.location.reload()}>
                Ansicht neu laden
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
