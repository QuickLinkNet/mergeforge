import {
  startModuleBuilding,
  type GameState,
  type HexCoord,
  type ModuleManifest,
  type StartModuleBuildingRejection,
} from '@mergeforge/domain';
import type { LoadedModule } from './moduleRegistry';

const failureCopy: Readonly<Record<StartModuleBuildingRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'terrain-not-allowed': 'Auf diesem Gelände kann dieses Gebäude nicht stehen.',
  'not-visible': 'Dieses Feld liegt noch im Nebel.',
  'road-required': 'Das Feld braucht einen Straßenanschluss.',
  'already-built': 'Hier steht bereits ein Gebäude.',
  'module-version-conflict': 'Dieses Modul liegt in einer anderen Version vor, als euer Spielstand nutzt.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'insufficient-resources': 'Es fehlen Holz oder Stein.',
};

/** Rejections worth showing: the tile fits, but something temporary is in the way. */
const SHOWN_WHEN_BLOCKED: ReadonlySet<StartModuleBuildingRejection> = new Set([
  'build-slot-occupied',
  'insufficient-resources',
  'module-version-conflict',
]);

const resourceName = { wood: 'Holz', stone: 'Stein' } as const;

function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1_000);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/** An <img> never runs scripts, unlike inline svg markup. */
function iconSource(icon: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(icon)}`;
}

interface ModuleBuildPanelProps {
  readonly state: GameState;
  readonly coord: HexCoord;
  readonly nowMs: number;
  readonly modules: readonly LoadedModule[];
  readonly onBuild: (manifest: ModuleManifest) => void;
  readonly onCancel: () => void;
}

export function ModuleBuildPanel({ state, coord, nowMs, modules, onBuild, onCancel }: ModuleBuildPanelProps) {
  const entries = modules
    .map((module) => ({ module, result: startModuleBuilding(state, module.manifest, coord, nowMs) }))
    .filter(({ result }) => result.ok || SHOWN_WHEN_BLOCKED.has(result.reason));

  return (
    <>
      {entries.map(({ module, result }) => {
        const { manifest, icon } = module;
        const { cost, production, buildTimeMs } = manifest.building;
        const titleId = `module-title-${manifest.id}`;
        return (
          <section className="build-card module-card" aria-labelledby={titleId} key={manifest.id}>
            <div className="build-card-heading">
              <img className="module-icon" src={iconSource(icon)} alt="" width={40} height={40} />
              <span><small>Gebäude planen · Modul</small><h2 id={titleId}>{manifest.name}</h2></span>
            </div>
            <dl className="build-preview">
              <div><dt>Kosten</dt><dd>{cost.wood} Holz · {cost.stone} Stein</dd></div>
              <div><dt>Bauzeit</dt><dd>{formatDuration(buildTimeMs)}</dd></div>
              <div>
                <dt>Ertrag</dt>
                <dd>+{production.amountPerPulse} {resourceName[production.resource]} / Takt</dd>
              </div>
            </dl>
            {result.ok
              ? <p className="build-explanation">Nur ein Gebäude kann gleichzeitig im Bau sein.</p>
              : <p className="build-warning" role="status">{failureCopy[result.reason]}</p>}
            <div className="build-actions">
              <button className="secondary-action" type="button" onClick={onCancel}>Abbrechen</button>
              <button
                className="primary-action"
                type="button"
                disabled={!result.ok}
                onClick={() => onBuild(manifest)}
              >
                {manifest.name} errichten
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}
