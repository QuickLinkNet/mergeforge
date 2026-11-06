import { useEffect } from 'react';

/**
 * Clears a transient message after `delayMs`. A new value restarts the timer;
 * an inactive value (null, empty list) starts none.
 */
export function useAutoDismiss(value: unknown, active: boolean, clear: () => void, delayMs: number): void {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(clear, delayMs);
    return () => window.clearTimeout(timer);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- restart only for a new value
}
