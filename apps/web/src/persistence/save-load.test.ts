import {
  LUMBER_CAMP_BUILD_MS,
  PATHFINDER_BASE_MAX_CHARGES,
  QUARRY_BUILD_MS,
  advanceTime,
  startSurveyTent,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { describe, expect, it } from 'vitest';
import { GAME_SAVE_KEY, loadGame, saveGame } from './index';
import {
  MemoryStorage,
  stateWithActivePathfinder,
  stateWithLumberCamp,
  stateWithQuarry,
  world,
} from './test-helpers';

describe('versioned local game persistence', () => {
  it('round-trips roads, resources, finds, buildings, and timestamps', () => {
    const storage = new MemoryStorage();
    const state = stateWithLumberCamp();

    expect(saveGame(storage, state)).toBe(true);
    const loaded = loadGame(storage, world);

    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.state.roadTileKeys).toEqual(state.roadTileKeys);
    expect(loaded.state.resources).toEqual(state.resources);
    expect(loaded.state.claimedSurfaceFindTileKeys).toEqual(state.claimedSurfaceFindTileKeys);
    expect(loaded.state.buildings).toEqual(state.buildings);
    expect(loaded.state.prologue).toEqual(state.prologue);
    expect(loaded.state.lastAdvancedAtMs).toBe(2_000);
  });

  it('restores elapsed construction and production through explicit time advancement', () => {
    const storage = new MemoryStorage();
    const state = stateWithLumberCamp();
    saveGame(storage, state);
    const loaded = loadGame(storage, world);
    if (loaded.kind !== 'loaded') throw new Error('Expected loaded state');

    const restored = advanceTime(loaded.state, 2_000 + LUMBER_CAMP_BUILD_MS);

    expect(restored.buildings[0]?.status).toBe('active');
    expect(restored.resources.wood).toBe(state.resources.wood + 2);
  });

  it('round-trips a quarry and restores its elapsed stone production', () => {
    const storage = new MemoryStorage();
    const state = stateWithQuarry();
    saveGame(storage, state);

    const loaded = loadGame(storage, world);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;

    expect(loaded.state.buildings).toEqual(state.buildings);
    const restored = advanceTime(loaded.state, 2_000 + QUARRY_BUILD_MS);
    expect(restored.buildings[0]).toMatchObject({ type: 'quarry', status: 'active' });
    expect(restored.resources.stone).toBe(state.resources.stone + 1);
  });

  it('rejects a persisted quarry when its stone site no longer exists', () => {
    const storage = new MemoryStorage();
    saveGame(storage, stateWithQuarry());
    const worldWithoutSite: WorldSnapshot = { ...world, resourceSites: [] };

    expect(loadGame(storage, worldWithoutSite)).toEqual({ kind: 'reset', reason: 'corrupt' });
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull();
  });

  it('round-trips the active pathfinder and village survey tent', () => {
    const storage = new MemoryStorage();
    const pathfinderState = stateWithActivePathfinder();
    const tent = startSurveyTent(pathfinderState, pathfinderState.lastAdvancedAtMs);
    if (!tent.ok) throw new Error(tent.reason);

    expect(saveGame(storage, tent.state)).toBe(true);
    const loaded = loadGame(storage, world);

    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.state.units).toEqual(tent.state.units);
    expect(loaded.state.buildings).toContainEqual(expect.objectContaining({ type: 'survey-tent', tileKey: '0,0' }));
  });

  it('rejects manipulated pathfinder positions and charge counts', () => {
    const storage = new MemoryStorage();
    saveGame(storage, stateWithActivePathfinder());
    const raw = storage.getItem(GAME_SAVE_KEY);
    if (raw === null) throw new Error('Expected save payload');
    const payload = JSON.parse(raw) as { units: Array<{ tileKey: string; charges: number }> };
    payload.units[0]!.tileKey = '0,1';
    payload.units[0]!.charges = PATHFINDER_BASE_MAX_CHARGES + 1;
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));

    expect(loadGame(storage, world)).toEqual({ kind: 'reset', reason: 'corrupt' });
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull();
  });

  it('round-trips completed chapter state without duplicating milestones on reload', () => {
    const storage = new MemoryStorage();
    const base = stateWithActivePathfinder();
    const state = {
      ...base,
      prologue: {
        stoneProductionObserved: true,
        pathfinderSurveysCompleted: 1,
        completedChapterIds: [3] as const,
        eventIds: [] as const,
      },
    };

    saveGame(storage, state);
    const firstLoad = loadGame(storage, world);
    expect(firstLoad.kind).toBe('loaded');
    if (firstLoad.kind !== 'loaded') return;
    expect(firstLoad.state.prologue.completedChapterIds).toEqual([3]);

    saveGame(storage, firstLoad.state);
    const secondLoad = loadGame(storage, world);
    expect(secondLoad.kind).toBe('loaded');
    if (secondLoad.kind !== 'loaded') return;
    expect(secondLoad.state.prologue).toEqual(firstLoad.state.prologue);
  });

  it('rejects non-sequential chapter history and relay events still hidden by fog', () => {
    const storage = new MemoryStorage();
    saveGame(storage, stateWithActivePathfinder());
    const raw = storage.getItem(GAME_SAVE_KEY);
    if (raw === null) throw new Error('Expected save payload');
    const payload = JSON.parse(raw) as {
      prologue: { completedChapterIds: number[]; eventIds: string[] };
    };
    payload.prologue.completedChapterIds = [4];
    payload.prologue.eventIds = ['relay_discovered'];
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));

    expect(loadGame(storage, world)).toEqual({ kind: 'reset', reason: 'corrupt' });
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull();
  });

  it('removes malformed saves and requests a controlled reset', () => {
    const storage = new MemoryStorage();
    storage.setItem(GAME_SAVE_KEY, '{broken');

    expect(loadGame(storage, world)).toEqual({ kind: 'reset', reason: 'corrupt' });
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull();
  });

  it('rejects saves from another format or generated world', () => {
    const storage = new MemoryStorage();
    saveGame(storage, stateWithLumberCamp());
    const otherWorld = { ...world, generatorVersion: 'm1.4-future' };

    expect(loadGame(storage, otherWorld)).toEqual({ kind: 'reset', reason: 'incompatible' });
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull();
  });
});
