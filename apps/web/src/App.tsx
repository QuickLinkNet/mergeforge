import { useEffect, useMemo, useRef, useState } from 'react';
import { mountHexWorld } from '@mergeforge/renderer-pixi';
import { generateWorld } from '@mergeforge/worldgen';

const WORLD_SEED = 'mergeforge-genesis-001';
const WORLD_RADIUS = 7;

type ViewState = 'loading' | 'ready' | 'error';

export function App() {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const worldResult = useMemo(() => {
    try {
      return { world: generateWorld({ seed: WORLD_SEED, radius: WORLD_RADIUS }) } as const;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Die Welt konnte nicht erzeugt werden.',
      } as const;
    }
  }, []);

  useEffect(() => {
    const host = mapHostRef.current;
    if (host === null || !('world' in worldResult)) {
      if ('error' in worldResult) {
        setErrorMessage(worldResult.error);
        setViewState('error');
      }
      return;
    }

    let disposed = false;
    let renderer: { destroy(): void } | undefined;

    setViewState('loading');
    void mountHexWorld(host, worldResult.world)
      .then((mountedRenderer) => {
        if (disposed) {
          mountedRenderer.destroy();
          return;
        }
        renderer = mountedRenderer;
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
      renderer?.destroy();
    };
  }, [worldResult]);

  const generatorVersion = 'world' in worldResult ? worldResult.world.generatorVersion : 'unbekannt';

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

        <div className="status-cluster" aria-label="Startstatus, Vorschau">
          <span className="preview-label">Startwerte · Vorschau</span>
          <span className="resource">
            <i className="resource-dot wood" aria-hidden="true" />
            <span>Holz</span>
            <strong>12</strong>
          </span>
          <span className="resource">
            <i className="resource-dot stone" aria-hidden="true" />
            <span>Stein</span>
            <strong>6</strong>
          </span>
          <span className="chapter-status">Kapitel 1 · Gründungsring</span>
        </div>
      </header>

      <section className="mission-card" aria-labelledby="mission-title">
        <div className="mission-kicker">
          <span>Erstes Ziel</span>
          <span className="prototype-badge">Ansichtsvorschau</span>
        </div>
        <h1 id="mission-title">Ein Weg ins Unbekannte</h1>
        <p>
          Euer Dorf ist sicher – doch jenseits des Nebels wartet die Welt. Erkundet den Waldrand
          und plant die erste Straße.
        </p>
        <div className="objective" aria-label="Vorgesehenes Kapitelziel">
          <span className="objective-icon" aria-hidden="true">◇</span>
          <span>
            <small>Vorgesehenes Kapitelziel</small>
            Zwei Straßenfelder errichten
          </span>
          <strong>0 / 2</strong>
        </div>
        <p className="mission-note">Bauen und Ressourcen folgen in der nächsten Ausbaustufe.</p>
      </section>

      <aside className="world-badge" aria-label="Weltdaten">
        <span className="signal-dot" aria-hidden="true" />
        <span>
          <small>Genesis-Sektor</small>
          {WORLD_SEED}
        </span>
        <span className="version">Gen {generatorVersion}</span>
      </aside>

      <aside className="camera-hints" aria-label="Kamerasteuerung">
        <span><kbd>Drag</kbd> Karte bewegen</span>
        <span><kbd>Scroll</kbd> Zoomen</span>
        <span className="touch-hint">Auf Touch-Geräten ziehen und spreizen</span>
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
