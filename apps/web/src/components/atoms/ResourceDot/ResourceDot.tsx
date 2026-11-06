import './ResourceDot.css';

export type ResourceDotKind = 'wood' | 'stone' | 'charge' | 'core';

/** Glowing colour dot that stands for a resource (decorative). */
export function ResourceDot({ kind }: { readonly kind: ResourceDotKind }) {
  return <i className={`resource-dot ${kind}`} aria-hidden="true" />;
}
