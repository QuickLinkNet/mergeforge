import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { advanceTime, type GameState } from '@mergeforge/domain';
import { nextSettlementAt } from '../game/clock';

/**
 * Wall clock for countdowns, ticking every second. The game state is only advanced when
 * something actually settles, and never behind the last saved moment.
 */
export function useGameClock(
  initialNowMs: number,
  setGameState: Dispatch<SetStateAction<GameState | null>>,
): number {
  const [nowMs, setNowMs] = useState(initialNowMs);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      setGameState((current) => {
        if (current === null) return current;
        const safeNow = Math.max(currentNow, current.lastAdvancedAtMs);
        return safeNow >= nextSettlementAt(current) ? advanceTime(current, safeNow) : current;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- state setters are stable
  return nowMs;
}
