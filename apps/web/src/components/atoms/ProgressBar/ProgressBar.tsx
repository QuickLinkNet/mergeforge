import './ProgressBar.css';

export interface ProgressBarProps {
  /** Accessible name, e.g. "Baufortschritt". */
  readonly label: string;
  /** Share done, 0…1. */
  readonly value: number;
}

/** Thin progress bar for constructions, training and repairs. */
export function ProgressBar({ label, value }: ProgressBarProps) {
  return (
    <div
      className="construction-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    ><span style={{ width: `${value * 100}%` }} /></div>
  );
}
