import { useMemo } from 'react';
import type { GameState } from '@mergeforge/domain';
import { describeMission, type Mission } from '../game/mission';

/** Chapter texts for the current state (pure logic lives in game/mission.ts). */
export function useMissionText(gameState: GameState | null): Mission {
  return useMemo(() => describeMission(gameState), [gameState]);
}
