import {
  GAME_STATE_SCHEMA_VERSION,
  RELAY_REPAIR_MS,
  WORKSHOP_BUILD_MS,
  WORLD_PULSE_MS,
  advanceTime,
  createInitialGameState,
  rotateSignalwerkRune,
  scanFarSignals,
  startLumberUpgrade,
  startQuarryUpgrade,
  startRelayRepair,
  startStorehouse,
  startWorkshop,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { createSignalwerkPuzzle } from '@mergeforge/signalwerk';
import { describe, expect, it } from 'vitest';
import { GAME_SAVE_KEY, loadGame, saveGame } from './index';
import { MemoryStorage } from './test-helpers';

type Payload = Record<string, any>;

const sinkWorld: WorldSnapshot = {
  seed: 'phase-b-seed',
  generatorVersion: 'm4.0-test',
  radius: 9,
  tiles: Array.from({ length: 10 }, (_, q) => ({
    coord: { q, r: 0 },
    terrain: q === 1 ? ('forest' as const) : ('meadow' as const),
    elevation: 1,
  })),
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0'],
  resourceSites: [{ id: 'stone:2,0', type: 'stone', tileKey: '2,0' }],
  relaySite: { id: 'relay:local:9,0', tileKey: '9,0' },
  surfaceFinds: [],
};
const SCAN_AT = WORKSHOP_BUILD_MS + RELAY_REPAIR_MS;

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

/** A finished prologue (chapter 7) with an active lumber camp and quarry and a full base storage. */
function chapterSevenState(): GameState {
  const roads = Array.from({ length: 8 }, (_, index) => `${index + 1},0`);
  const initial = createInitialGameState(sinkWorld, 0);
  const base: GameState = {
    ...initial,
    resources: { wood: 40, stone: 40 },
    roadTileKeys: roads,
    visibleTileKeys: ['0,0', ...roads, '9,0'],
    buildings: [{ id: 'survey-tent:0,0', type: 'survey-tent', tileKey: '0,0', status: 'active', startedAtMs: 0, completesAtMs: 0 }],
    units: [{ id: 'pathfinder', type: 'pathfinder', status: 'active', tileKey: '0,0', charges: 0, startedAtMs: 0, completesAtMs: 0, lastChargeAtMs: 0 }],
    prologue: { stoneProductionObserved: true, pathfinderSurveysCompleted: 1, completedChapterIds: [3, 4, 5], eventIds: ['relay_discovered'] },
  };
  const workshop = startWorkshop(solved(base), 0);
  if (!workshop.ok) throw new Error(workshop.reason);
  const repair = startRelayRepair(advanceTime(workshop.state, WORKSHOP_BUILD_MS), WORKSHOP_BUILD_MS);
  if (!repair.ok) throw new Error(repair.reason);
  const scan = scanFarSignals(advanceTime(repair.state, SCAN_AT), SCAN_AT);
  if (!scan.ok) throw new Error(scan.reason);
  return {
    ...scan.state,
    resources: { wood: 300, stone: 150 },
    buildings: [
      ...scan.state.buildings,
      { id: 'lumber-camp:1,0', type: 'lumber-camp', tileKey: '1,0', status: 'active', startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: SCAN_AT },
      { id: 'quarry:2,0', type: 'quarry', tileKey: '2,0', status: 'active', startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: SCAN_AT },
    ],
  };
}

function ok<T extends { ok: boolean; state: GameState }>(result: T): GameState {
  if (!result.ok) throw new Error('Expected the command to succeed.');
  return result.state;
}

/** Chapter 8 finished: storehouse level 1, both upgrades, then settled. */
function chapterEightState(): GameState {
  let now = SCAN_AT;
  let state = ok(startStorehouse(chapterSevenState(), now));
  now += 3 * WORLD_PULSE_MS;
  state = ok(startLumberUpgrade(state, now));
  now += 2 * WORLD_PULSE_MS;
  state = ok(startQuarryUpgrade(state, now));
  return advanceTime(state, now + 3 * WORLD_PULSE_MS);
}

function savedPayload(state: GameState): { storage: MemoryStorage; payload: Payload } {
  const storage = new MemoryStorage();
  saveGame(storage, state);
  const raw = storage.getItem(GAME_SAVE_KEY);
  if (raw === null) throw new Error('Expected save payload');
  return { storage, payload: JSON.parse(raw) as Payload };
}

function loadMutated(state: GameState, mutate: (payload: Payload) => void) {
  const { storage, payload } = savedPayload(state);
  mutate(payload);
  storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
  return loadGame(storage, sinkWorld);
}

function expectCorrupt(state: GameState, mutate: (payload: Payload) => void) {
  expect(loadMutated(state, mutate)).toEqual({ kind: 'reset', reason: 'corrupt' });
}

const storehouseIndex = (payload: Payload) =>
  (payload.buildings as Payload[]).findIndex((building) => building.type === 'storehouse');

describe('phase B persistence (schema 8)', () => {
  it('saves schema 8 and round-trips storehouse, upgrades and chapter 8', () => {
    const state = chapterEightState();
    expect(state.prologue.completedChapterIds).toEqual([3, 4, 5, 6, 7, 8]);
    const { storage, payload } = savedPayload(state);
    expect(payload.gameSchemaVersion).toBe(8);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(8);
    expect(loadGame(storage, sinkWorld)).toEqual({ kind: 'loaded', state });
  });

  it('round-trips a storehouse under construction', () => {
    const state = ok(startStorehouse(chapterSevenState(), SCAN_AT));
    const { storage } = savedPayload(state);
    expect(loadGame(storage, sinkWorld)).toEqual({ kind: 'loaded', state });
  });

  it('migrates a schema-7 save with storehouse level 0 and no upgrades', () => {
    const state = chapterSevenState();
    const loaded = loadMutated(state, (payload) => { payload.gameSchemaVersion = 7; });
    expect(loaded).toEqual({ kind: 'loaded', state });
    if (loaded.kind !== 'loaded') return;
    expect(loaded.state.schemaVersion).toBe(8);
    expect(loaded.state.buildings.some((building) => building.type === 'storehouse')).toBe(false);
    // The migrated game can start the new sinks right away.
    expect(startStorehouse(loaded.state, SCAN_AT).ok).toBe(true);
  });

  it('rejects schema-7 saves that already contain new buildings or chapter 8', () => {
    const later = ok(startStorehouse(chapterSevenState(), SCAN_AT));
    expectCorrupt(later, (payload) => { payload.gameSchemaVersion = 7; });
    expectCorrupt(chapterEightState(), (payload) => { payload.gameSchemaVersion = 7; });
  });

  it('rejects corrupt storehouse and upgrade rows', () => {
    const state = chapterEightState();
    expectCorrupt(state, (payload) => { payload.buildings[storehouseIndex(payload)].level = 4; });
    expectCorrupt(state, (payload) => { payload.buildings[storehouseIndex(payload)].level = 0; });
    expectCorrupt(state, (payload) => { payload.buildings[storehouseIndex(payload)].level = '1'; });
    expectCorrupt(state, (payload) => { delete payload.buildings[storehouseIndex(payload)].level; });
    expectCorrupt(state, (payload) => { payload.buildings[storehouseIndex(payload)].capacity = 9999; });
    expectCorrupt(state, (payload) => { payload.buildings[storehouseIndex(payload)].id = 'storehouse:1,0'; });
    expectCorrupt(state, (payload) => { payload.buildings[storehouseIndex(payload)].tileKey = '1,0'; });
    expectCorrupt(state, (payload) => { payload.buildings.push({ ...payload.buildings[storehouseIndex(payload)] }); });
    expectCorrupt(state, (payload) => {
      const upgrade = (payload.buildings as Payload[]).find((building) => building.type === 'lumber-upgrade');
      if (upgrade !== undefined) upgrade.level = 2;
    });
    expectCorrupt(state, (payload) => {
      const upgrade = (payload.buildings as Payload[]).find((building) => building.type === 'quarry-upgrade');
      if (upgrade !== undefined) upgrade.status = 'done';
    });
    expectCorrupt(state, (payload) => {
      payload.buildings = (payload.buildings as Payload[]).filter((building) => building.type !== 'lumber-camp');
    });
  });

  it('checks the stock against the finished storehouse level', () => {
    const state = chapterEightState();
    const fullLevelOne = loadMutated(state, (payload) => { payload.resources = { wood: 450, stone: 225 }; });
    expect(fullLevelOne.kind).toBe('loaded');
    expectCorrupt(state, (payload) => { payload.resources = { wood: 451, stone: 0 }; });
    expectCorrupt(state, (payload) => { payload.resources = { wood: 0, stone: 226 }; });
    // While level 1 is still being built the old limit applies.
    const building = ok(startStorehouse(chapterSevenState(), SCAN_AT));
    expectCorrupt(building, (payload) => { payload.resources = { wood: 301, stone: 0 }; });
    expectCorrupt(chapterSevenState(), (payload) => { payload.resources = { wood: 801, stone: 0 }; });
  });

  it('rejects chapter 8 and its event when they disagree with the buildings', () => {
    const state = chapterEightState();
    expectCorrupt(state, (payload) => { payload.prologue.eventIds = payload.prologue.eventIds.slice(0, 4); });
    expectCorrupt(state, (payload) => { payload.prologue.completedChapterIds = [3, 4, 5, 6, 7]; });
    expectCorrupt(chapterSevenState(), (payload) => {
      payload.prologue.completedChapterIds = [3, 4, 5, 6, 7, 8];
      payload.prologue.eventIds = [...payload.prologue.eventIds, 'founders_works_completed'];
    });
    expectCorrupt(state, (payload) => { payload.prologue.eventIds = [...payload.prologue.eventIds, 'founders_works_completed']; });
    expectCorrupt(state, (payload) => { payload.prologue.completedChapterIds = [3, 4, 5, 6, 8]; });
  });
});
