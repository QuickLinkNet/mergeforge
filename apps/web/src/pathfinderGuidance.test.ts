import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  buildRoad,
  createInitialGameState,
  movePathfinder,
  startPathfinderTraining,
  advanceTime,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { entryStatus, fieldCandidates } from './buildMenuStatus';
import { pathfinderGuidance } from './pathfinderGuidance';

// A straight strip of land east of the village, fog beyond the third field.
const world: WorldSnapshot = {
  seed: 'guidance-test',
  generatorVersion: 'm1.3-test',
  radius: 5,
  tiles: [0, 1, 2, 3, 4, 5].map((q) => ({
    coord: { q, r: 0 },
    terrain: q === 2 ? ('forest' as const) : ('meadow' as const),
    elevation: 1,
  })),
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0'],
  resourceSites: [],
  relaySite: { id: 'relay:local:5,0', tileKey: '5,0' },
  surfaceFinds: [],
};

function withActivePathfinder(roads: number): GameState {
  let state: GameState = { ...createInitialGameState(world, 0), resources: { wood: 40, stone: 10 } };
  for (let q = 1; q <= roads; q += 1) {
    const result = buildRoad(state, { q, r: 0 });
    if (!result.ok) throw new Error(`road ${q} failed: ${result.reason}`);
    state = result.state;
  }
  const training = startPathfinderTraining(state, 1_000);
  if (!training.ok) throw new Error('training failed');
  return advanceTime(training.state, 1_000 + 600_000);
}

describe('pathfinderGuidance', () => {
  it('says nothing without an active pathfinder', () => {
    expect(pathfinderGuidance(createInitialGameState(world, 0))).toBeNull();
  });

  it('first sends the player to a road end, with the road end highlighted', () => {
    const state = withActivePathfinder(2);
    const guidance = pathfinderGuidance(state);
    expect(guidance?.step).toBe('move');
    expect(guidance?.text).toContain('Schritt 1 von 2');
    expect(guidance?.highlightKeys).toEqual(['2,0']);
  });

  it('then points at the hidden field two steps away', () => {
    const state = withActivePathfinder(2);
    const moved = movePathfinder(state, { q: 2, r: 0 }, 700_000);
    expect(moved.ok).toBe(true);
    const guidance = pathfinderGuidance(moved.state);
    expect(guidance?.step).toBe('survey');
    expect(guidance?.text).toContain('Schritt 2 von 2');
    expect(guidance?.highlightKeys).toEqual(['4,0']);
  });

  it('is quiet once the first survey is done', () => {
    const state = withActivePathfinder(2);
    const done: GameState = {
      ...state,
      prologue: { ...state.prologue, pathfinderSurveysCompleted: 1 },
    };
    expect(pathfinderGuidance(done)).toBeNull();
  });
});

describe('build menu reasons', () => {
  const catalog = buildCatalog([]);
  const noteOf = (state: GameState, id: string) => {
    const entry = catalog.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(id);
    const status = entryStatus(entry, state, 2_000, fieldCandidates(state, entry, []), []);
    return status.note;
  };

  it('tells the player to explore when no forest is in sight yet', () => {
    expect(noteOf(createInitialGameState(world, 0), 'lumber-camp')).toBe('Noch kein Wald in Sicht: erkunde weiter');
  });

  it('tells the player to build a road once the forest is in sight', () => {
    const state = createInitialGameState(world, 0);
    const seen: GameState = { ...state, visibleTileKeys: [...state.visibleTileKeys, '2,0'] };
    expect(noteOf(seen, 'lumber-camp')).toBe('Zuerst eine Straße bis zu einem Wald-Feld bauen');
  });

  it('shows the pathfinder next step on its menu card', () => {
    expect(noteOf(withActivePathfinder(2), 'pathfinder')).toContain('Schritt 1 von 2');
  });
});
