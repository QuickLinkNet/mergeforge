import { useRef } from 'react';

export const COMMAND_COOLDOWN_MS = 500;

/**
 * A fast double click must not trigger a second command: after the first one the card
 * under the cursor changes (e.g. tent built -> pathfinder move card appears in the same spot).
 * Returns a wrapper; all wrapped commands share one cooldown.
 */
export function useCommandGuard() {
  const lastCommandAtRef = useRef(0);
  return <Args extends unknown[]>(command: (...args: Args) => void) => (...args: Args): void => {
    const now = performance.now();
    if (now - lastCommandAtRef.current < COMMAND_COOLDOWN_MS) return;
    lastCommandAtRef.current = now;
    command(...args);
  };
}
