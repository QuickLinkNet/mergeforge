import {
  advanceTime,
  buildRoad,
  createInitialGameState,
  startModuleBuilding,
  type GameState,
  type ModuleManifest,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { describe, expect, it } from 'vitest';
import { GAME_SAVE_KEY, loadGame, saveGame } from './index';
import { MemoryStorage } from './test-helpers';

describe('module building persistence', () => {
  const PULSE = 10 * 60 * 1000;
  const forestWorld: WorldSnapshot = {
    seed: 'module-building-seed',
    generatorVersion: 'm4.5-test',
    radius: 9,
    tiles: Array.from({ length: 10 }, (_, q) => ({
      coord: { q, r: 0 },
      terrain: q === 3 ? ('forest' as const) : ('meadow' as const),
      elevation: 1,
    })),
    village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
    visibleTileKeys: ['0,0', '1,0'],
    resourceSites: [],
    relaySite: { id: 'relay:local:9,0', tileKey: '9,0' },
    surfaceFinds: [],
  };
  const manifest: ModuleManifest = {
    manifestVersion: 1,
    id: 'harzsammler',
    version: '1.0.0',
    name: 'Harzsammler',
    building: {
      placement: { terrain: ['forest'], requiresRoadConnection: true },
      cost: { wood: 3, stone: 1 },
      buildTimeMs: PULSE,
      icon: 'icon.svg',
      production: { resource: 'wood', amountPerPulse: 1 },
    },
  };
  const registry = [{ id: 'harzsammler', version: '1.0.0' }];

  function moduleState(): GameState {
    let state = createInitialGameState(forestWorld, 0);
    for (const q of [1, 2, 3]) {
      const road = buildRoad(state, { q, r: 0 });
      if (!road.ok) throw new Error(road.reason);
      state = road.state;
    }
    const built = startModuleBuilding({ ...state, resources: { wood: 20, stone: 10 } }, manifest, { q: 3, r: 0 }, 0);
    if (!built.ok) throw new Error(built.reason);
    return built.state;
  }

  function save(state: GameState): { storage: MemoryStorage; payload: Record<string, any> } {
    const storage = new MemoryStorage();
    saveGame(storage, state);
    return { storage, payload: JSON.parse(storage.getItem(GAME_SAVE_KEY) ?? 'null') as Record<string, any> };
  }

  function corrupt(mutate: (payload: Record<string, any>) => void) {
    const { storage, payload } = save(moduleState());
    mutate(payload);
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    expect(loadGame(storage, forestWorld, registry, [manifest])).toEqual({ kind: 'reset', reason: 'corrupt' });
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull();
  }

  it('round-trips a module building with its production rule and reference', () => {
    const state = moduleState();
    const { storage } = save(state);
    expect(loadGame(storage, forestWorld, registry, [manifest])).toEqual({ kind: 'loaded', state });
    const later = advanceTime(state, 3 * PULSE);
    saveGame(storage, later);
    expect(loadGame(storage, forestWorld, registry, [manifest])).toEqual({ kind: 'loaded', state: later });
  });

  it('blocks, without touching the save, when the module is not provided', () => {
    const { storage } = save(moduleState());
    const raw = storage.getItem(GAME_SAVE_KEY);
    expect(loadGame(storage, forestWorld, [], [])).toEqual({
      kind: 'blocked',
      missing: [{ id: 'harzsammler', version: '1.0.0' }],
    });
    expect(storage.getItem(GAME_SAVE_KEY)).toBe(raw);
  });

  it('rejects a module building that no module reference covers', () => {
    corrupt((payload) => { payload.modules = []; });
    corrupt((payload) => { payload.modules = [{ id: 'harzsammler', version: '2.0.0' }]; });
  });

  it('rejects malformed or tampered module buildings', () => {
    corrupt((payload) => { payload.buildings[0].moduleId = 'Bad Id'; });
    corrupt((payload) => { payload.buildings[0].id = 'module:other:3,0'; });
    corrupt((payload) => { payload.buildings[0].extra = true; });
    corrupt((payload) => { delete payload.buildings[0].production; });
    corrupt((payload) => { payload.buildings[0].production.resource = 'gold'; });
    corrupt((payload) => { payload.buildings[0].production.amountPerPulse = 0; });
    corrupt((payload) => { payload.buildings[0].production.amountPerPulse = 99; });
    corrupt((payload) => { payload.buildings[0].production.amountPerPulse = 1.5; });
    corrupt((payload) => { payload.buildings[0].production.bonus = 1; });
  });

  it('rejects a production rule or placement that no longer matches the manifest', () => {
    corrupt((payload) => { payload.buildings[0].production.amountPerPulse = 5; });
    corrupt((payload) => { payload.buildings[0].production.resource = 'stone'; });
    corrupt((payload) => { payload.roadTileKeys = payload.roadTileKeys.filter((key: string) => key !== '3,0'); });
  });
});
