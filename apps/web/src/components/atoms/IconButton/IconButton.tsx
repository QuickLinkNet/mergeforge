import './IconButton.css';

export interface IconButtonProps {
  /** Accessible name, e.g. "Hinweis schließen". */
  readonly label: string;
  readonly onClick: () => void;
  /** Context class (e.g. "signalwerk-close"); the look comes from the surrounding component. */
  readonly className?: string;
  readonly glyph?: string;
}

/** Square glyph-only button, by default the × close button. */
export function IconButton({ label, onClick, className, glyph = '×' }: IconButtonProps) {
  const classes = className === undefined ? 'icon-button' : `${className} icon-button`;
  return <button className={classes} type="button" aria-label={label} onClick={onClick}>{glyph}</button>;
}
