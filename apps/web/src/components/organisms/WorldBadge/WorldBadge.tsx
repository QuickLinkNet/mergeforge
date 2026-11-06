import { Badge } from '../../atoms/Badge/Badge';
import './WorldBadge.css';

export interface WorldBadgeProps {
  /** "Genesis-Sektor" offline, "Sektor q|r" online. */
  readonly sectorLabel: string;
  readonly worldSeed: string;
  readonly generatorVersion: string;
}

/** World identity in the bottom-left corner. */
export function WorldBadge({ sectorLabel, worldSeed, generatorVersion }: WorldBadgeProps) {
  return (
    <aside className="world-badge" aria-label="Weltdaten">
      <span className="signal-dot" aria-hidden="true" />
      <span><small>{sectorLabel}</small>{worldSeed}</span>
      <Badge variant="version">Gen {generatorVersion}</Badge>
    </aside>
  );
}
