import { useEffect, useRef } from 'react';
import type { GameState } from '@mergeforge/domain';
import { sinkCompletionMessage } from '../game/sinks';

/**
 * Announces a finished storehouse level or production upgrade once. The first loaded
 * state only sets the baseline, so a reload never repeats the message.
 */
export function useSinkNotices(gameState: GameState | null, setEventMessage: (message: string) => void) {
  const previousRef = useRef<GameState | null>(null);
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = gameState;
    if (previous === null || gameState === null || previous === gameState) return;
    const message = sinkCompletionMessage(previous, gameState);
    if (message !== null) setEventMessage(message);
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps -- the setter is stable
}
