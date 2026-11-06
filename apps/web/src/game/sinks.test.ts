import { describe, expect, it } from 'vitest';
import {
  WORLD_PULSE_MS,
  advanceTime,
  buildCatalog,
  createInitialGameState,
  startLumberUpgrade,
  startStorehouse,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { entryStatus } from './buildMenuStatus';
import { menuEntryForState, sinkCompletionMessage, sinkStartMessage, sinkStatus } from './sinks';

const world: WorldSnapshot = {
  seed: 'sinks-test',
  generatorVersion: 'sinks-test',
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

function chapterSeven(resources = { wood: 300, stone: 150 }, completed: GameState['prologue']['completedChapterIds'] = [3, 4, 5, 6, 7]): GameState {
  const initial = createInitialGameState(world, 0);
  return {
    ...initial,
    resources,
    roadTileKeys: ['1,0', '0,1'],
    buildings: [
      { id: 'lumber-camp:1,0', type: 'lumber-camp', tileKey: '1,0', status: 'active', startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0 },
      { id: 'quarry:0,1', type: 'quarry', tileKey: '0,1', status: 'active', startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0 },
    ],
    prologue: { ...initial.prologue, completedChapterIds: completed },
  };
}

const catalog = buildCatalog([]);
const entry = (id: string) => {
  const found = catalog.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no catalog entry ${id}`);
  return found;
};

describe('sink menu status', () => {
  it('explains why the sinks are locked before chapter 7', () => {
    const state = chapterSeven(undefined, [3, 4, 5, 6]);
    expect(sinkStatus('storehouse', state, 0)).toEqual({
      kind: 'locked',
      note: 'Stufe 0 von 3 · Das Lagerhaus wird erst nach Kapitel 7 (Fernsignal scannen) freigeschaltet.',
    });
    expect(sinkStatus('lumber-upgrade', state, 0)).toMatchObject({ kind: 'locked', note: expect.stringContaining('Kapitel 7') });
  });

  it('offers the storehouse with its level and the bigger storage', () => {
    const state = chapterSeven();
    expect(entryStatus(entry('storehouse'), state, 0, [])).toEqual({
      kind: 'ready',
      note: 'Stufe 0 von 3 · Ausbau: Lager 450 Holz / 225 Stein',
    });
    expect(sinkStatus('quarry-upgrade', state, 0)).toEqual({ kind: 'ready', note: 'Im Dorf ausbauen' });
  });

  it('names missing resources and a missing producer', () => {
    expect(sinkStatus('storehouse', chapterSeven({ wood: 50, stone: 10 }), 0)).toEqual({
      kind: 'locked',
      note: 'Stufe 0 von 3 · Es fehlen 10 Holz und 20 Stein',
    });
    const noCamp = chapterSeven();
    const withoutCamp = { ...noCamp, buildings: noCamp.buildings.filter((building) => building.type !== 'lumber-camp') };
    expect(sinkStatus('lumber-upgrade', withoutCamp, 0)).toEqual({ kind: 'locked', note: 'Zuerst ein Holzfällerlager fertig bauen.' });
  });

  it('shows the running build with its remaining time and then the next level', () => {
    const started = startStorehouse(chapterSeven(), 0);
    if (!started.ok) throw new Error(started.reason);
    expect(sinkStatus('storehouse', started.state, 60_000)).toEqual({
      kind: 'running',
      note: 'Stufe 0 von 3 · Stufe 1 wird gebaut',
      remainingMs: 3 * WORLD_PULSE_MS - 60_000,
    });
    expect(sinkStatus('lumber-upgrade', started.state, 60_000)).toMatchObject({ kind: 'locked', note: expect.stringContaining('Bauplatz') });
    const done = advanceTime(started.state, 3 * WORLD_PULSE_MS);
    const next = { ...done, resources: { wood: 300, stone: 150 } };
    expect(sinkStatus('storehouse', next, 3 * WORLD_PULSE_MS)).toEqual({
      kind: 'ready',
      note: 'Stufe 1 von 3 · Ausbau: Lager 600 Holz / 300 Stein',
    });
    expect(menuEntryForState(entry('storehouse'), next)).toMatchObject({ cost: { wood: 120, stone: 60 }, buildMs: 6 * WORLD_PULSE_MS });
    expect(menuEntryForState(entry('quarry-upgrade'), next)).toBe(entry('quarry-upgrade'));
  });

  it('reports the highest level as done', () => {
    const base = chapterSeven();
    const state: GameState = {
      ...base,
      buildings: [...base.buildings, { id: 'storehouse:0,0', type: 'storehouse', tileKey: '0,0', status: 'active', level: 3, startedAtMs: 0, completesAtMs: 0 }],
    };
    expect(sinkStatus('storehouse', state, 0)).toEqual({ kind: 'done', note: 'Stufe 3 von 3 · Lager 800 Holz / 400 Stein' });
  });
});

describe('sink messages', () => {
  it('announces the order and its completion once', () => {
    const before = chapterSeven();
    expect(sinkStartMessage('storehouse', before)).toBe('Lagerhaus Stufe 1 beauftragt · Fertigstellung in 30:00');
    expect(sinkStartMessage('lumber-upgrade', before)).toBe('Holzfäller-Ausbau beauftragt · Fertigstellung in 20:00');

    const started = startStorehouse(before, 0);
    if (!started.ok) throw new Error(started.reason);
    const done = advanceTime(started.state, 3 * WORLD_PULSE_MS);
    expect(sinkCompletionMessage(before, started.state)).toBeNull();
    expect(sinkCompletionMessage(started.state, done)).toBe('Lagerhaus Stufe 1 fertig · Lager fasst jetzt 450 Holz / 225 Stein');
    expect(sinkCompletionMessage(done, advanceTime(done, 4 * WORLD_PULSE_MS))).toBeNull();

    const upgrade = startLumberUpgrade({ ...done, resources: { wood: 300, stone: 150 } }, 3 * WORLD_PULSE_MS);
    if (!upgrade.ok) throw new Error(upgrade.reason);
    expect(sinkCompletionMessage(upgrade.state, advanceTime(upgrade.state, 5 * WORLD_PULSE_MS))).toBe(
      'Holzfäller-Ausbau fertig · Jedes Holzfällerlager liefert jetzt 4 Holz pro Takt',
    );
  });
});
