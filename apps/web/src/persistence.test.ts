import {
  RELAY_REPAIR_MS,
  WORKSHOP_BUILD_MS,
  LUMBER_CAMP_BUILD_MS,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_TRAINING_MS,
  QUARRY_BUILD_MS,
  advanceTime,
  buildRoad,
  createInitialGameState,
  scanFarSignals,
  startModuleBuilding,
  startPathfinderTraining,
  startLumberCamp,
  startQuarry,
  startSurveyTent,
  startRelayRepair,
  startWorkshop,
  rotateSignalwerkRune,
  type GameState,
  type ModuleManifest,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { createSignalwerkPuzzle } from '@mergeforge/signalwerk';
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

function stateWithActivePathfinder() {
  const started = startPathfinderTraining(createInitialGameState(world, 1_000), 2_000);
  if (!started.ok) throw new Error(started.reason);
  return advanceTime(started.state, 2_000 + PATHFINDER_TRAINING_MS);
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

type Payload = Record<string, any>;

describe('chapter 7 persistence', () => {
  const lineWorld: WorldSnapshot = {
    seed: 'chapter-seven-seed',
    generatorVersion: 'm3.3-test',
    radius: 9,
    tiles: Array.from({ length: 10 }, (_, q) => ({
      coord: { q, r: 0 },
      terrain: 'meadow' as const,
      elevation: 1,
    })),
    village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
    visibleTileKeys: ['0,0', '1,0'],
    resourceSites: [],
    relaySite: { id: 'relay:local:9,0', tileKey: '9,0' },
    surfaceFinds: [],
  };

  function solved(state: GameState): GameState {
    const puzzle = createSignalwerkPuzzle(state.signalwerk.seed);
    let current = state;
    for (let index = 0; index < puzzle.solutionRotations.length && !current.signalwerk.solved; index += 1) {
      while (!current.signalwerk.solved && current.signalwerk.rotations[index] !== puzzle.solutionRotations[index]) {
        const rotated = rotateSignalwerkRune(current, index);
        if (!rotated.ok) throw new Error(rotated.reason);
        current = rotated.state;
      }
    }
    return current;
  }

  function relayActiveState(): GameState {
    const roads = Array.from({ length: 8 }, (_, index) => `${index + 1},0`);
    const initial = createInitialGameState(lineWorld, 0);
    const tent = {
      id: 'survey-tent:0,0',
      type: 'survey-tent' as const,
      tileKey: '0,0',
      status: 'active' as const,
      startedAtMs: 0,
      completesAtMs: 0,
    };
    const base: GameState = {
      ...initial,
      resources: { wood: 40, stone: 40 },
      roadTileKeys: roads,
      visibleTileKeys: ['0,0', ...roads, '9,0'],
      buildings: [tent],
      units: [{
        id: 'pathfinder',
        type: 'pathfinder',
        status: 'active',
        tileKey: '0,0',
        charges: 0,
        startedAtMs: 0,
        completesAtMs: 0,
        lastChargeAtMs: 0,
      }],
      prologue: {
        stoneProductionObserved: true,
        pathfinderSurveysCompleted: 1,
        completedChapterIds: [3, 4, 5],
        eventIds: ['relay_discovered'],
      },
    };
    const workshop = startWorkshop(solved(base), 0);
    if (!workshop.ok) throw new Error(workshop.reason);
    const repair = startRelayRepair(advanceTime(workshop.state, WORKSHOP_BUILD_MS), WORKSHOP_BUILD_MS);
    if (!repair.ok) throw new Error(repair.reason);
    return advanceTime(repair.state, WORKSHOP_BUILD_MS + RELAY_REPAIR_MS);
  }

  function scannedState(): GameState {
    const scan = scanFarSignals(relayActiveState(), WORKSHOP_BUILD_MS + RELAY_REPAIR_MS);
    if (!scan.ok) throw new Error(scan.reason);
    return scan.state;
  }

  function savedPayload(state: GameState): { storage: MemoryStorage; payload: Payload } {
    const storage = new MemoryStorage();
    saveGame(storage, state);
    const raw = storage.getItem(GAME_SAVE_KEY);
    if (raw === null) throw new Error('Expected save payload');
    return { storage, payload: JSON.parse(raw) as Payload };
  }

  function expectCorrupt(mutate: (payload: Payload) => void) {
    const { storage, payload } = savedPayload(scannedState());
    mutate(payload);
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    expect(loadGame(storage, lineWorld)).toEqual({ kind: 'reset', reason: 'corrupt' });
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull();
  }

  it('reaches chapter 7 only through the scan and round-trips signals, capability and event', () => {
    expect(relayActiveState().prologue.completedChapterIds).toEqual([3, 4, 5, 6]);
    const state = scannedState();
    expect(state.prologue.completedChapterIds).toEqual([3, 4, 5, 6, 7]);

    const { storage } = savedPayload(state);
    const loaded = loadGame(storage, lineWorld);
    expect(loaded).toEqual({ kind: 'loaded', state });

    if (loaded.kind !== 'loaded') return;
    saveGame(storage, loaded.state);
    expect(loadGame(storage, lineWorld)).toEqual({ kind: 'loaded', state });
  });

  it('migrates a schema-5 save with finished chapter 6 without granting chapter 7', () => {
    const state = relayActiveState();
    const { storage, payload } = savedPayload(state);
    payload.gameSchemaVersion = 5;
    delete payload.signals;
    delete payload.relay.capabilities;
    payload.prologue.completedChapterIds = [3, 4, 5, 6];
    payload.prologue.eventIds = ['relay_discovered', 'signalwerk_solved', 'relay_repaired'];
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));

    const loaded = loadGame(storage, lineWorld);
    expect(loaded).toEqual({ kind: 'loaded', state });

    if (loaded.kind !== 'loaded') return;
    saveGame(storage, loaded.state);
    expect(loadGame(storage, lineWorld)).toEqual({ kind: 'loaded', state });

    const scan = scanFarSignals(loaded.state, WORKSHOP_BUILD_MS + RELAY_REPAIR_MS);
    expect(scan.ok).toBe(true);
    expect(scanFarSignals(scan.state, WORKSHOP_BUILD_MS + RELAY_REPAIR_MS)).toMatchObject({ ok: false, reason: 'already-scanned' });
  });

  it('keeps an unfinished schema-5 save at its chapter without signals', () => {
    const { storage, payload } = savedPayload(stateWithActivePathfinder());
    payload.gameSchemaVersion = 5;
    delete payload.signals;
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));

    const loaded = loadGame(storage, world);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.state.signals).toEqual([]);
    expect(loaded.state.prologue.completedChapterIds).toEqual([]);
  });

  it('migrates a schema-6 save to schema 7 with no modules', () => {
    const state = scannedState();
    const { storage, payload } = savedPayload(state);
    payload.gameSchemaVersion = 6;
    delete payload.modules;
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    expect(loadGame(storage, lineWorld)).toEqual({ kind: 'loaded', state });
  });

  it('blocks a save that needs a missing module and leaves it untouched', () => {
    const { storage, payload } = savedPayload(scannedState());
    payload.modules = [{ id: 'harzsammler', version: '1.0.0' }];
    const raw = JSON.stringify(payload);
    storage.setItem(GAME_SAVE_KEY, raw);

    expect(loadGame(storage, lineWorld)).toEqual({
      kind: 'blocked',
      missing: [{ id: 'harzsammler', version: '1.0.0' }],
    });
    expect(storage.getItem(GAME_SAVE_KEY)).toBe(raw);

    // A different version of the same module is still missing.
    expect(loadGame(storage, lineWorld, [{ id: 'harzsammler', version: '2.0.0' }]).kind).toBe('blocked');
    expect(storage.getItem(GAME_SAVE_KEY)).toBe(raw);
  });

  it('recovers once the module is provided at the saved version', () => {
    const { storage, payload } = savedPayload(scannedState());
    payload.modules = [{ id: 'harzsammler', version: '1.0.0' }];
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    const loaded = loadGame(storage, lineWorld, [{ id: 'harzsammler', version: '1.0.0' }]);
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') {
      expect(loaded.state.modules).toEqual([{ id: 'harzsammler', version: '1.0.0' }]);
    }
  });

  it('rejects malformed module references as corrupt', () => {
    expectCorrupt((payload) => { payload.modules = 'x'; });
    expectCorrupt((payload) => { payload.modules = [{ id: 'Bad Id', version: '1.0.0' }]; });
    expectCorrupt((payload) => { payload.modules = [{ id: 'a', version: 'v1' }]; });
    expectCorrupt((payload) => { payload.modules = [{ id: 'a', version: '1.0.0', path: '/x' }]; });
    expectCorrupt((payload) => { payload.modules = [{ id: 'a', version: '1.0.0' }, { id: 'a', version: '1.1.0' }]; });
    expectCorrupt((payload) => { delete payload.modules; });
  });

  it('still rejects unknown schema generations as incompatible', () => {
    const { storage, payload } = savedPayload(scannedState());
    payload.gameSchemaVersion = 4;
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    expect(loadGame(storage, lineWorld)).toEqual({ kind: 'reset', reason: 'incompatible' });
  });

  it('rejects tampered or extended signals', () => {
    expectCorrupt((payload) => { payload.signals[0].bearing = payload.signals[0].bearing === 'east' ? 'west' : 'east'; });
    expectCorrupt((payload) => { payload.signals[1].distanceBand = payload.signals[1].distanceBand === 'near' ? 'far' : 'near'; });
    expectCorrupt((payload) => { payload.signals[0].coord = { q: 20, r: 3 }; });
    expectCorrupt((payload) => { payload.signals = payload.signals.slice(0, 1); });
    expectCorrupt((payload) => { payload.signals = [...payload.signals, payload.signals[0]]; });
    expectCorrupt((payload) => { payload.signals = 'x'; });
  });

  it('rejects inconsistent chapter 7, capability and event combinations', () => {
    expectCorrupt((payload) => { payload.relay.capabilities = []; });
    expectCorrupt((payload) => { payload.relay.capabilities = ['signal_network_active', 'signal_network_active']; });
    expectCorrupt((payload) => { payload.relay.capabilities = ['teleport']; });
    expectCorrupt((payload) => { delete payload.relay.capabilities; });
    expectCorrupt((payload) => { payload.signals = []; });
    expectCorrupt((payload) => { payload.prologue.eventIds = payload.prologue.eventIds.slice(0, 3); });
    expectCorrupt((payload) => { payload.prologue.completedChapterIds = [3, 4, 5, 6]; });
    expectCorrupt((payload) => { payload.prologue.completedChapterIds = [3, 4, 5, 6, 7, 7]; });
    expectCorrupt((payload) => { payload.prologue.completedChapterIds = [3, 4, 5, 7]; });
  });

  it('rejects signals while the relay is still dormant', () => {
    const { storage, payload } = savedPayload(stateWithActivePathfinder());
    payload.signals = [
      { id: 'signal:0', bearing: 'east', distanceBand: 'near' },
      { id: 'signal:1', bearing: 'west', distanceBand: 'far' },
    ];
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    expect(loadGame(storage, world)).toEqual({ kind: 'reset', reason: 'corrupt' });
  });
});

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
