import { describe, expect, it } from 'vitest';
import {
  buildRoad,
  createInitialGameState,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { describeMission } from './mission';

const world: WorldSnapshot = {
  seed: 'mission-test',
  generatorVersion: 'mission-test',
  radius: 2,
  tiles: [
    { coord: { q: 0, r: 0 }, terrain: 'meadow', elevation: 1 },
    { coord: { q: 1, r: 0 }, terrain: 'meadow', elevation: 1 },
    { coord: { q: 2, r: 0 }, terrain: 'forest', elevation: 2 },
    { coord: { q: 0, r: 1 }, terrain: 'hills', elevation: 3 },
  ],
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0', '0,1'],
  resourceSites: [{ id: 'stone:0,1', type: 'stone', tileKey: '0,1' }],
  relaySite: { id: 'relay:local:2,0', tileKey: '2,0' },
  surfaceFinds: [],
};

function road(state: GameState, q: number, r: number): GameState {
  const result = buildRoad(state, { q, r });
  if (!result.ok) throw new Error(`road ${q},${r} failed: ${result.reason}`);
  return result.state;
}

describe('describeMission', () => {
  it('reads a missing state like the first chapter', () => {
    const mission = describeMission(null);
    expect(mission).toMatchObject({
      chapterNumber: 1,
      chapterName: 'Gründungsring',
      title: 'Ein Weg ins Unbekannte',
      objective: 'Zwei Straßenfelder errichten',
      progress: '0 / 2',
      complete: false,
    });
  });

  it('counts roads in chapter 1 and moves on to the forest line', () => {
    const fresh = createInitialGameState(world, 0);
    expect(describeMission(fresh).progress).toBe('0 / 2');
    const oneRoad = road(fresh, 1, 0);
    expect(describeMission(oneRoad).progress).toBe('1 / 2');
    const twoRoads = road(oneRoad, 2, 0);
    expect(describeMission(twoRoads)).toMatchObject({
      chapterNumber: 2,
      chapterName: 'Waldlinie',
      title: 'Die Waldlinie',
      objective: 'Holzfällerlager beauftragen',
      progress: '0 / 1',
      note: 'Das Holzfällerlager kostet 4 Holz und 1 Stein.',
    });
  });

  it('adds the relay direction to the dead-signal chapter', () => {
    const fresh = createInitialGameState(world, 0);
    const state: GameState = {
      ...fresh,
      roadTileKeys: ['1,0', '0,1'],
      buildings: [{
        id: 'lumber-camp:1,0', type: 'lumber-camp', tileKey: '1,0', status: 'active',
        startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0,
      }],
      prologue: { ...fresh.prologue, completedChapterIds: [3, 4] },
    };
    const mission = describeMission(state);
    expect(mission.chapterNumber).toBe(5);
    expect(mission.title).toBe('Das tote Signal');
    expect(mission.description).toContain('Das Signal kommt aus Richtung Osten');
    expect(mission.progress).toBe('0 / 1');
  });

  it('marks the first-signal chapter complete once both signals are in', () => {
    const fresh = createInitialGameState(world, 0);
    const state = {
      ...fresh,
      roadTileKeys: ['1,0', '0,1'],
      buildings: [{
        id: 'lumber-camp:1,0', type: 'lumber-camp', tileKey: '1,0', status: 'active',
        startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0,
      }],
      signalwerk: { ...fresh.signalwerk, solved: true },
      relay: { ...fresh.relay, status: 'active' },
      prologue: { ...fresh.prologue, completedChapterIds: [3, 4, 5, 6, 7] },
      signals: [{ id: 'a' }, { id: 'b' }],
    } as unknown as GameState;
    expect(describeMission(state)).toMatchObject({
      chapterNumber: 7,
      chapterName: 'Erstes Signal',
      title: 'Das erste Signal',
      progress: '2 / 2',
      complete: true,
    });
  });
});
