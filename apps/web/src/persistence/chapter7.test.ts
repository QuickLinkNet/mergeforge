import {
  RELAY_REPAIR_MS,
  WORKSHOP_BUILD_MS,
  advanceTime,
  createInitialGameState,
  scanFarSignals,
  startRelayRepair,
  startWorkshop,
  rotateSignalwerkRune,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { createSignalwerkPuzzle } from '@mergeforge/signalwerk';
import { describe, expect, it } from 'vitest';
import { GAME_SAVE_KEY, loadGame, saveGame } from './index';
import { MemoryStorage, stateWithActivePathfinder, world } from './test-helpers';

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

  it('migrates a schema-6 save to the current schema with no modules', () => {
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
