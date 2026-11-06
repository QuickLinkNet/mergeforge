import { describe, expect, it } from 'vitest';
import {
  buildRoad,
  createInitialGameState,
  type Building,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { chapterBannerText } from '../hooks/useChapterProgress';
import { describeMission, type Mission } from './mission';

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

  function chapterSevenDone(extraBuildings: readonly Building[] = [], completed: GameState['prologue']['completedChapterIds'] = [3, 4, 5, 6, 7]): GameState {
    const fresh = createInitialGameState(world, 0);
    return {
      ...fresh,
      roadTileKeys: ['1,0', '0,1'],
      buildings: [
        {
          id: 'lumber-camp:1,0', type: 'lumber-camp', tileKey: '1,0', status: 'active',
          startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0,
        },
        { id: 'workshop:0,0', type: 'workshop', tileKey: '0,0', status: 'active', startedAtMs: 0, completesAtMs: 0 },
        ...extraBuildings,
      ],
      signalwerk: { ...fresh.signalwerk, solved: true },
      relay: { ...fresh.relay, status: 'active' },
      prologue: { ...fresh.prologue, completedChapterIds: completed },
      signals: [{ id: 'a' }, { id: 'b' }],
    } as unknown as GameState;
  }

  it('shows the first-signal chapter until the scan', () => {
    const state = { ...chapterSevenDone([], [3, 4, 5, 6]), signals: [] };
    expect(describeMission(state)).toMatchObject({
      chapterNumber: 7,
      chapterName: 'Erstes Signal',
      title: 'Das erste Signal',
      objective: 'Fernsignal scannen',
      progress: '0 / 2',
      complete: false,
    });
  });

  it('moves on to chapter 8 "Das Gründerwerk" once chapter 7 is done', () => {
    expect(describeMission(chapterSevenDone())).toMatchObject({
      chapterNumber: 8,
      chapterName: 'Gründerwerk',
      title: 'Das Gründerwerk',
      objective: 'Lagerhaus Stufe 1 errichten',
      progress: '0 / 3',
      complete: false,
      note: 'Lagerhaus ◇ · Holzfäller-Ausbau ◇ · Steinbruch-Ausbau ◇',
    });
  });

  it('follows the chapter 8 goals step by step', () => {
    const storehouseBuilding: Building = { id: 'storehouse:0,0', type: 'storehouse', tileKey: '0,0', status: 'constructing', level: 1, startedAtMs: 0, completesAtMs: 10 };
    expect(describeMission(chapterSevenDone([storehouseBuilding])).objective).toBe('Lagerhaus Stufe 1 fertigstellen');
    const storehouse: Building = { ...storehouseBuilding, status: 'active' };
    expect(describeMission(chapterSevenDone([storehouse]))).toMatchObject({ objective: 'Holzfäller ausbauen', progress: '1 / 3' });
    const lumber: Building = { id: 'lumber-upgrade:0,0', type: 'lumber-upgrade', tileKey: '0,0', status: 'active', startedAtMs: 0, completesAtMs: 0 };
    const quarryRunning: Building = { id: 'quarry-upgrade:0,0', type: 'quarry-upgrade', tileKey: '0,0', status: 'constructing', startedAtMs: 0, completesAtMs: 10 };
    expect(describeMission(chapterSevenDone([storehouse, lumber, quarryRunning]))).toMatchObject({
      objective: 'Steinbruch-Ausbau fertigstellen',
      progress: '2 / 3',
      note: 'Lagerhaus ✓ · Holzfäller-Ausbau ✓ · Steinbruch-Ausbau ◇',
    });
  });

  it('shows the finished chapter 8 with the outlook on the neighbours', () => {
    const quarry: Building = { id: 'quarry-upgrade:0,0', type: 'quarry-upgrade', tileKey: '0,0', status: 'active', startedAtMs: 0, completesAtMs: 0 };
    const lumber: Building = { ...quarry, id: 'lumber-upgrade:0,0', type: 'lumber-upgrade' };
    const storehouse: Building = { id: 'storehouse:0,0', type: 'storehouse', tileKey: '0,0', status: 'active', level: 1, startedAtMs: 0, completesAtMs: 0 };
    const mission = describeMission(chapterSevenDone([storehouse, lumber, quarry], [3, 4, 5, 6, 7, 8]));
    expect(mission).toMatchObject({ chapterNumber: 8, progress: '3 / 3', complete: true, objective: 'Gründerwerk vollendet' });
    expect(mission.description.endsWith('Im Funkverkehr zeichnet sich ab, dass jemand näher kommt.')).toBe(true);
  });
});

describe('chapterBannerText', () => {
  const mission = (chapterNumber: number, complete: boolean): Mission => ({
    chapterNumber, chapterName: 'Gründerwerk', title: 't', description: 'Beschreibung.', objective: 'Ziel', progress: '0 / 3', complete, note: '',
  });

  it('announces the step from chapter 7 to chapter 8 and the finished chapter 8 once', () => {
    expect(chapterBannerText(null, mission(8, false))).toBeNull();
    expect(chapterBannerText({ chapterNumber: 7, complete: false }, mission(8, false))).toBe('Kapitel 7 geschafft! Kapitel 8: Gründerwerk · Ziel: Ziel');
    expect(chapterBannerText({ chapterNumber: 8, complete: false }, mission(8, true))).toBe('Kapitel 8 geschafft! Gründerwerk · Beschreibung.');
    expect(chapterBannerText({ chapterNumber: 8, complete: true }, mission(8, true))).toBeNull();
    expect(chapterBannerText({ chapterNumber: 8, complete: false }, mission(8, false))).toBeNull();
  });
});
