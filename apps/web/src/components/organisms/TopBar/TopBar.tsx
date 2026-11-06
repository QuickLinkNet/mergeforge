import { Badge } from '../../atoms/Badge/Badge';
import { ResourceChip } from '../../molecules/ResourceChip/ResourceChip';
import './TopBar.css';

export interface TopBarProps {
  readonly syncLabel: string;
  readonly wood: number;
  readonly stone: number;
  /** Present once a pathfinder exists. */
  readonly charges?: { readonly current: number; readonly max: number } | undefined;
  /** Present once the resonance core was found. */
  readonly core?: { readonly installed: boolean } | undefined;
  readonly chapterNumber: number;
  readonly chapterName: string;
  readonly chapterComplete: boolean;
}

/** Wordmark, stock and chapter status across the top of the map. */
export function TopBar({ syncLabel, wood, stone, charges, core, chapterNumber, chapterName, chapterComplete }: TopBarProps) {
  return (
    <header className="top-bar">
      <a className="wordmark" href="./" aria-label="MERGEFORGE Startseite">
        <span className="wordmark-mark" aria-hidden="true"><span /><span /><span /></span>
        <span>MERGEFORGE</span>
      </a>
      <div className="status-cluster" aria-label="Aktueller Dorfstatus">
        <span className="preview-label">{syncLabel}</span>
        <ResourceChip dot="wood" label="Holz" value={wood} ariaLabel={`Holz: ${wood}`} />
        <ResourceChip dot="stone" label="Stein" value={stone} ariaLabel={`Stein: ${stone}`} />
        {charges !== undefined && (
          <ResourceChip
            className="charges"
            dot="charge"
            label="Ladungen"
            value={<>{charges.current}/{charges.max}</>}
            ariaLabel={`Expeditionsladungen: ${charges.current} von ${charges.max}`}
          />
        )}
        {core !== undefined && (
          <ResourceChip
            className="core"
            dot="core"
            label="Resonanzkern"
            value={core.installed ? 'aktiv' : '1'}
            ariaLabel={`Resonanzkern: ${core.installed ? 'installiert' : 'im Inventar'}`}
          />
        )}
        <Badge variant="chapter" complete={chapterComplete}>
          Kapitel {chapterNumber} · {chapterName}
        </Badge>
      </div>
    </header>
  );
}
