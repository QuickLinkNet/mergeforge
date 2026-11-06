import { useEffect } from 'react';

/** Calls `onEscape` on the Escape key while `active` (e.g. to close a dialog). */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps -- the handler only closes
}
