import './Symbol.css';

export type SymbolVariant = 'camp' | 'quarry' | 'wayfinder' | 'survey' | 'tent' | 'relay' | 'workshop';

export interface SymbolProps {
  readonly glyph: string;
  /** Colour family; without a variant the symbol uses the gold road look. */
  readonly variant?: SymbolVariant;
}

/** Decorative glyph tile in front of a card heading (hidden from screen readers). */
export function Symbol({ glyph, variant }: SymbolProps) {
  const classes = variant === undefined ? 'road-symbol' : `road-symbol ${variant}-symbol`;
  return <span className={classes} aria-hidden="true">{glyph}</span>;
}
