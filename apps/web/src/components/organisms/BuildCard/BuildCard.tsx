import type { ReactNode } from 'react';
import { BuildCardHeading } from '../../molecules/BuildCardHeading/BuildCardHeading';
import './BuildCard.css';

export interface BuildCardProps {
  /** Extra classes after "build-card" (e.g. "exploration-card", "building-status-card"). */
  readonly className?: string;
  readonly titleId: string;
  readonly icon: ReactNode;
  readonly kicker: ReactNode;
  readonly title: ReactNode;
  readonly children?: ReactNode;
}

/** Frame shared by every card in the right-hand build stack. */
export function BuildCard({ className, titleId, icon, kicker, title, children }: BuildCardProps) {
  return (
    <section className={className === undefined ? 'build-card' : `build-card ${className}`} aria-labelledby={titleId}>
      <BuildCardHeading icon={icon} kicker={kicker} title={title} titleId={titleId} />
      {children}
    </section>
  );
}

/** Button row at the bottom of a card; "single" stretches one button. */
export function BuildActions({ single = false, children }: { readonly single?: boolean; readonly children: ReactNode }) {
  return <div className={single ? 'build-actions single' : 'build-actions'}>{children}</div>;
}

export function BuildExplanation({ children }: { readonly children: ReactNode }) {
  return <p className="build-explanation">{children}</p>;
}

/** Why the planned action is not possible right now. */
export function BuildWarning({ children }: { readonly children: ReactNode }) {
  return <p className="build-warning" role="status">{children}</p>;
}
