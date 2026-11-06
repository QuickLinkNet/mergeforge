import { describe, expect, it } from 'vitest';
import { buildRoad, createInitialGameState, type GameState, type WorldSnapshot } from '@mergeforge/domain';
import { relayGuidance } from './relayGuidance';

// Land strip east of the village; water at 2,0 forces the route around it through r = 1.
const land = [
  [0, 0], [1, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1],
] as const;
const world: WorldSnapshot = {
  seed: 'relay-guidance',
  generatorVersion: 'm1.3-test',
  radius: 5,
  tiles: [
    ...land.map(([q, r]) => ({ coord: { q, r }, terrain: 'meadow' as const, elevation: 1 })),
    { coord: { q: 2, r: 0 }, terrain: 'water' as const, elevation: 0 },
  ],
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0', '0,1'],
  resourceSites: [],
  relaySite: { id: 'relay:local:4,0', tileKey: '4,0' },
  surfaceFinds: [],
};

/** A state that has finished chapters 1 to 4, so chapter 5 is the current one. */
function chapterFive(): GameState {
  const state = createInitialGameState(world, 0);
  return { ...state, prologue: { ...state.prologue, completedChapterIds: [3, 4] } };
}

describe('relay guidance (chapter 5)', () => {
  it('is silent before chapter 5 and after the relay is discovered', () => {
    expect(relayGuidance(createInitialGameState(world, 0))).toBeNull();
    const state = chapterFive();
    expect(relayGuidance({ ...state, prologue: { ...state.prologue, eventIds: [...state.prologue.eventIds, 'relay_discovered'] } })).toBeNull();
  });

  it('highlights the next road field on the shortest land route and walks around water', () => {
    const first = relayGuidance(chapterFive());
    expect(first?.step).toBe('relay');
    expect(first?.highlightKeys).toContain('1,0');
    const a = buildRoad(chapterFive(), { q: 0, r: 1 });
    if (!a.ok) throw new Error('road failed');
    const built = buildRoad(a.state, { q: 1, r: 1 });
    if (!built.ok) throw new Error('road failed');
    const next = relayGuidance(built.state);
    expect(next?.highlightKeys.every((key) => key !== '2,0')).toBe(true);
    expect(next?.text).toContain('Straßenfelder');
  });

  it('warns when there is no wood for the next road', () => {
    const state = chapterFive();
    expect(relayGuidance({ ...state, resources: { wood: 0, stone: 0 } })?.text).toContain('1 Holz');
  });
});
