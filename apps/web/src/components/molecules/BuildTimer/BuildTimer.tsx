import type { ReactNode } from 'react';
import './BuildTimer.css';

/** Label on the left, live countdown (or status) on the right. */
export function BuildTimer({ label, value }: { readonly label: ReactNode; readonly value: ReactNode }) {
  return <div className="building-timer"><span>{label}</span><strong aria-live="polite">{value}</strong></div>;
}
