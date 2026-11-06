import type { ReactNode } from 'react';
import './Badge.css';

export type BadgeVariant = 'prototype' | 'chapter' | 'version';

export interface BadgeProps {
  readonly variant: BadgeVariant;
  /** Only for the chapter badge: green once the chapter goal is reached. */
  readonly complete?: boolean;
  readonly children: ReactNode;
}

function badgeClass(variant: BadgeVariant, complete: boolean): string {
  switch (variant) {
    case 'prototype': return 'prototype-badge';
    case 'version': return 'version';
    case 'chapter': return `chapter-status ${complete ? 'complete' : ''}`;
  }
}

/** Small inline label: prototype marker, chapter status or generator version. */
export function Badge({ variant, complete = false, children }: BadgeProps) {
  return <span className={badgeClass(variant, complete)}>{children}</span>;
}
