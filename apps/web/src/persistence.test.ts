import {
  LUMBER_CAMP_BUILD_MS,
  QUARRY_BUILD_MS,
  advanceTime,
  buildRoad,
  createInitialGameState,
  startLumberCamp,
  startQuarry,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { describe, expect, it } from 'vitest';
import { GAME_SAVE_KEY, loadGame, saveGame, type StorageLike } from './persistence';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const world: WorldSnapshot = {
  seed: 'mergeforge-genesis-001',
  generatorVersion: 'm1.3-test',
  radius: 1,
  tiles: [
    { coord: { q: 0, r: 0 }, terrain: 'meadow', elevation: 1 },
    { coord: { q: 1, r: 0 }, terrain: 'forest', elevation: 2 },
    { coord: { q: 0, r: 1 }, terrain: 'hills', elevation: 3 },
  ],
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0', '0,1'],
  resourceSites: [{ id: 'stone:0,1', type: 'stone', tileKey: '0,1' }],
  relaySite: { id: 'relay:local:1,0', tileKey: '1,0' },
  surfaceFinds: [],
};

function stateWithLumberCamp() {
  const road = buildRoad(createInitialGameState(world, 1_000), { q: 1, r: 0 });
  if (!road.ok) throw new Error(road.reason);
  const camp = startLumberCamp(road.state, { q: 1, r: 0 }, 2_000);
  if (!camp.ok) throw new Error(camp.reason);
  return camp.state;
}

function stateWithQuarry() {
  const road = buildRoad(createInitialGameState(world, 1_000), { q: 0, r: 1 });
  if (!road.ok) throw new Error(road.reason);
  const quarry = startQuarry(road.state, { q: 0, r: 1 }, 2_000);
  if (!quarry.ok) throw new Error(quarry.reason);
  return quarry.state;
}

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
