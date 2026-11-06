import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '@mergeforge/domain';
import type { Mission } from '../game/mission';
import { useAutoDismiss } from './useAutoDismiss';

export const CHAPTER_BANNER_MS = 9_000;

/** Banner text for a chapter step, or null when nothing new was reached. */
export function chapterBannerText(
  previous: { readonly chapterNumber: number; readonly complete: boolean } | null,
  mission: Mission,
): string | null {
  if (previous === null) return null;
  if (mission.chapterNumber > previous.chapterNumber) {
    return `Kapitel ${previous.chapterNumber} geschafft! Kapitel ${mission.chapterNumber}: ${mission.chapterName} · Ziel: ${mission.objective}`;
  }
  // The last chapter has no successor yet: its completion gets its own banner.
  if (mission.chapterNumber === previous.chapterNumber && mission.complete && !previous.complete) {
    return `Kapitel ${mission.chapterNumber} geschafft! ${mission.chapterName} · ${mission.description}`;
  }
  return null;
}

/**
 * Announces a finished chapter once. The first loaded state only sets the baseline,
 * so a reload never repeats the banner.
 */
export function useChapterProgress(gameState: GameState | null, mission: Mission) {
  const [chapterBanner, setChapterBanner] = useState<string | null>(null);
  const previousRef = useRef<{ chapterNumber: number; complete: boolean } | null>(null);
  const { chapterNumber, complete } = mission;

  useEffect(() => {
    if (gameState === null) return;
    const text = chapterBannerText(previousRef.current, mission);
    previousRef.current = { chapterNumber, complete };
    if (text !== null) setChapterBanner(text);
  }, [gameState === null, chapterNumber, complete]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissChapterBanner = useCallback(() => setChapterBanner(null), []);
  useAutoDismiss(chapterBanner, chapterBanner !== null, dismissChapterBanner, CHAPTER_BANNER_MS);

  return { chapterBanner, dismissChapterBanner };
}
