import { useEffect } from 'react';
import type { GameState } from '@mergeforge/domain';
import type { OnlineSession } from '../online';
import { saveGame, type StorageLike } from '../persistence';

/** Saves every state change locally and tells the online sync about it. */
export function useAutoSave(
  gameState: GameState | null,
  gameStorage: StorageLike | undefined,
  online: OnlineSession | undefined,
  setSystemNotice: (notice: string) => void,
): void {
  useEffect(() => {
    if (gameState === null) return;
    let saved = false;
    try {
      saved = saveGame(gameStorage ?? window.localStorage, gameState);
    } catch {
      saved = false;
    }
    if (!saved) setSystemNotice('Der lokale Spielstand konnte nicht gespeichert werden.');
    else online?.sync.noteChange();
  }, [gameState, gameStorage, online]); // eslint-disable-line react-hooks/exhaustive-deps -- setter is stable
}
