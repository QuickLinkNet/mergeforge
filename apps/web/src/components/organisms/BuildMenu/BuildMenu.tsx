import { useMemo } from 'react';
import {
  buildPulses,
  hasCompletedChapter,
  formatBuildTime,
  type CatalogCategory,
  type CatalogEntry,
  type GameState,
  type ModuleManifest,
} from '@mergeforge/domain';
import { entryStatus, fieldCandidates, type MenuStatus } from '../../../game/buildMenuStatus';
import { Button } from '../../atoms/Button/Button';
import { IconButton } from '../../atoms/IconButton/IconButton';
import { ResourceDot } from '../../atoms/ResourceDot/ResourceDot';
import './BuildMenu.css';

const categoryLabel: Readonly<Record<CatalogCategory, string>> = {
  infrastructure: 'Infrastruktur',
  production: 'Produktion',
  unit: 'Einheit',
  research: 'Forschung',
  network: 'Signalnetz',
  module: 'Modul',
};

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface BuildMenuProps {
  readonly state: GameState;
  readonly nowMs: number;
  readonly catalog: readonly CatalogEntry[];
  readonly modules: readonly ModuleManifest[];
  readonly onClose: () => void;
  /** The player pressed the main button of an entry that is ready or needs a field. */
  readonly onAction: (entry: CatalogEntry, status: MenuStatus) => void;
  /** Test tool for the maintainer: moves the game clock forward by one world pulse. */
  readonly onSkipTime?: () => void;
  /** False in the offline sandbox: trading needs the online account. */
  readonly tradeAvailable?: boolean;
}

/** Bottom drawer with everything the player can build, what it costs and why something is locked. */
export function BuildMenu({ state, nowMs, catalog, modules, onClose, onAction, onSkipTime, tradeAvailable = true }: BuildMenuProps) {
  // The field search is the expensive part, so it only follows the game state, not the clock.
  const candidates = useMemo(() => {
    const byId = new Map<string, readonly string[]>();
    for (const entry of catalog) {
      if (entry.placement === 'field') byId.set(entry.id, fieldCandidates(state, entry, modules));
    }
    return byId;
  }, [catalog, modules, state]);

  const rows = catalog
    .filter((entry) => entry.revealAfterChapter === undefined || hasCompletedChapter(state, entry.revealAfterChapter))
    .map((entry) => ({ entry, status: entryStatus(entry, state, nowMs, candidates.get(entry.id) ?? [], modules, tradeAvailable) }));
  const running = rows.filter((row) => row.status.kind === 'running');

  return (
    <section className="build-menu" aria-labelledby="build-menu-title">
      <header className="build-menu-header">
        <h2 id="build-menu-title">Bauen</h2>
        <span className="build-menu-resources">
          <ResourceDot kind="wood" /> {state.resources.wood}
          <ResourceDot kind="stone" /> {state.resources.stone}
        </span>
        <span className="build-menu-legend">1 Takt = 10 Minuten Spielzeit</span>
        {running.map(({ entry, status }) => (
          <span className="build-menu-running" key={entry.id} role="status">
            {entry.name}: noch {status.kind === 'running' ? formatClock(status.remainingMs) : ''}
          </span>
        ))}
        {onSkipTime !== undefined && (
          <button className="build-menu-skip" type="button" onClick={onSkipTime}>Test: 10 Min vorspulen</button>
        )}
        <IconButton className="build-menu-close" label="Baumenü schließen" onClick={onClose} />
      </header>
      <ul className="build-menu-cards">
        {rows.map(({ entry, status }) => {
          const pulses = buildPulses(entry.buildMs);
          const cost =
            entry.cost.wood === 0 && entry.cost.stone === 0
              ? 'kostenlos'
              : [entry.cost.wood > 0 ? `${entry.cost.wood} Holz` : '', entry.cost.stone > 0 ? `${entry.cost.stone} Stein` : '']
                  .filter(Boolean)
                  .join(' · ');
          const actionable = status.kind === 'ready' || status.kind === 'field';
          return (
            <li className={`build-menu-card status-${status.kind}`} key={entry.id}>
              <small>{categoryLabel[entry.category]}</small>
              <h3>{entry.name}</h3>
              <p className="build-menu-cost">{cost}</p>
              <p className="build-menu-time">
                {entry.buildMs === 0 ? 'Sofort' : `${formatBuildTime(entry.buildMs)} (${pulses} ${pulses === 1 ? 'Takt' : 'Takte'})`}
              </p>
              <p className="build-menu-effect">{entry.effect}</p>
              <p className="build-menu-note" role="status">
                {status.kind === 'running' ? `${status.note} · noch ${formatClock(status.remainingMs)}` : status.note}
              </p>
              {actionable && (
                <Button variant="primary" onClick={() => onAction(entry, status)}>
                  {status.kind === 'field' ? 'Feld wählen' : entry.placement === 'village' && entry.cost.wood + entry.cost.stone === 0 ? 'Starten' : 'Bauen'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export interface BuildMenuToggleProps {
  readonly open: boolean;
  readonly onToggle: () => void;
}

/** Round button at the bottom that opens and closes the build menu. */
export function BuildMenuToggle({ open, onToggle }: BuildMenuToggleProps) {
  return (
    <button
      className="build-menu-toggle"
      type="button"
      aria-expanded={open}
      onClick={onToggle}
    >
      {open ? 'Baumenü schließen' : 'Bauen'}
    </button>
  );
}
