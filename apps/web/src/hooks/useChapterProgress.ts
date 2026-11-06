import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@mergeforge/domain';
import type { Mission } from '../game/mission';
import { useAutoDismiss } from './useAutoDismiss';

export const CHAPTER_BANNER_MS = 9_000;

/**
 * Announces a finished chapter once. The first loaded state only sets the baseline,
 * so a reload never repeats the banner.
 */
export function useChapterProgress(gameState: GameState | null, mission: Mission) {
  const [chapterBanner, setChapterBanner] = useState<string | null>(null);
  const previousChapterRef = useRef<number | null>(null);
  const { chapterNumber, chapterName, objective } = mission;

  useEffect(() => {
    if (gameState === null) return;
    const previous = previousChapterRef.current;
    previousChapterRef.current = chapterNumber;
    if (previous !== null && chapterNumber > previous) {
      setChapterBanner(`Kapitel ${previous} geschafft! Kapitel ${chapterNumber}: ${chapterName} · Ziel: ${objective}`);
    }
  }, [gameState === null, chapterNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissChapterBanner = useCallback(() => setChapterBanner(null), []);
  useAutoDismiss(chapterBanner, chapterBanner !== null, dismissChapterBanner, CHAPTER_BANNER_MS);

  return { chapterBanner, dismissChapterBanner };
}
