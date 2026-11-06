import type { ReactNode } from 'react';
import './BuildPreview.css';

export interface BuildPreviewItem {
  readonly label: string;
  readonly value: ReactNode;
}

/** Three-column fact row of a card (cost, time, effect …). */
export function BuildPreview({ items }: { readonly items: readonly BuildPreviewItem[] }) {
  return (
    <dl className="build-preview">
      {items.map((item) => (
        <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
      ))}
    </dl>
  );
}
