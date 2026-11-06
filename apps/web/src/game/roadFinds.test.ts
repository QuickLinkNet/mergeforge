import { describe, expect, it } from 'vitest';
import { buildRoad, createInitialGameState, type WorldSnapshot } from '@mergeforge/domain';
import { describeRoadOutcome } from './roadFinds';

const world: WorldSnapshot = {
  seed: 'road-finds-test',
  generatorVersion: 'road-finds-test',
  radius: 3,
  tiles: [
    { coord: { q: 0, r: 0 }, terrain: 'meadow', elevation: 1 },
    { coord: { q: 1, r: 0 }, terrain: 'meadow', elevation: 1 },
    { coord: { q: 2, r: 0 }, terrain: 'forest', elevation: 2 },
    { coord: { q: 2, r: -1 }, terrain: 'meadow', elevation: 1 },
    { coord: { q: 0, r: 1 }, terrain: 'meadow', elevation: 1 },
  ],
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0', '0,1'],
  resourceSites: [],
  relaySite: { id: 'relay:local:2,0', tileKey: '2,0' },
  surfaceFinds: [{ id: 'surface-find:stone:2,-1', resourceType: 'stone', tileKey: '2,-1', amount: 4 }],
};

describe('describeRoadOutcome', () => {
  it('reports nothing when a road reveals no find and no relay', () => {
    const before = createInitialGameState(world, 0);
    const result = buildRoad(before, { q: 0, r: 1 });
    if (!result.ok) throw new Error(result.reason);
    expect(describeRoadOutcome(before, result.state)).toEqual({ effects: null, message: null });
  });

  it('collects wood and stone finds and names the relay discovery', () => {
    const before = createInitialGameState(world, 0);
    const result = buildRoad(before, { q: 1, r: 0 });
    if (!result.ok) throw new Error(result.reason);
    const outcome = describeRoadOutcome(before, result.state);
    expect(outcome.effects).toEqual(expect.arrayContaining([
      { tileKey: '2,0', resource: 'wood' },
      { tileKey: '2,-1', resource: 'stone' },
    ]));
    expect(outcome.message).toMatch(/^(Funde geborgen|Relais entdeckt) · \+\d+ Holz · \+4 Stein$/);
  });
});
