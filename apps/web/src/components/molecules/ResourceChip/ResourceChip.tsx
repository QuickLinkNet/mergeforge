import type { ReactNode } from 'react';
import { ResourceDot, type ResourceDotKind } from '../../atoms/ResourceDot/ResourceDot';
import './ResourceChip.css';

export interface ResourceChipProps {
  readonly dot: ResourceDotKind;
  readonly label: string;
  readonly value: ReactNode;
  /** Storage limit shown after the value ("120 / 300"); omitted when there is none. */
  readonly limit?: number | undefined;
  /** Full sentence for screen readers, e.g. "Holz: 12". */
  readonly ariaLabel: string;
  /** Extra class after "resource" (e.g. "charges"). */
  readonly className?: string;
}

/** One stock entry in the top bar: dot, label, value (and its storage limit). */
export function ResourceChip({ dot, label, value, limit, ariaLabel, className }: ResourceChipProps) {
  return (
    <span
      className={className === undefined ? 'resource' : `resource ${className}`}
      aria-label={ariaLabel}
      title={limit === undefined ? undefined : `Lager: höchstens ${limit}`}
    >
      <ResourceDot kind={dot} /><span>{label}</span>
      <strong>
        {value}
        {limit !== undefined && <span className="resource-limit"> / {limit}</span>}
      </strong>
    </span>
  );
}
