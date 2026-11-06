import type { ReactNode } from 'react';
import { ResourceDot, type ResourceDotKind } from '../../atoms/ResourceDot/ResourceDot';
import './ResourceChip.css';

export interface ResourceChipProps {
  readonly dot: ResourceDotKind;
  readonly label: string;
  readonly value: ReactNode;
  /** Full sentence for screen readers, e.g. "Holz: 12". */
  readonly ariaLabel: string;
  /** Extra class after "resource" (e.g. "charges"). */
  readonly className?: string;
}

/** One stock entry in the top bar: dot, label, value. */
export function ResourceChip({ dot, label, value, ariaLabel, className }: ResourceChipProps) {
  return (
    <span className={className === undefined ? 'resource' : `resource ${className}`} aria-label={ariaLabel}>
      <ResourceDot kind={dot} /><span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
