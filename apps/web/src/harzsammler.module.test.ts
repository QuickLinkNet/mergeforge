import { WORLD_PULSE_MS, advanceTime, buildRoad, createInitialGameState, startModuleBuilding, type Terrain, type WorldSnapshot } from '@mergeforge/domain';
import { describe, expect, it } from 'vitest';
import { LOADED_MODULES, MODULE_LOAD_ERRORS, MODULE_REGISTRY } from './moduleRegistry';

/**
 * Proof for "an extension without core changes": the Harzsammler is only
 * data under modules/harzsammler/. These tests drive the generic core with it.
 */
describe('Harzsammler module', () => {
  const loaded = LOADED_MODULES.find(({ manifest }) => manifest.id === 'harzsammler');

  it('ships as valid data and appears in the registry', () => {
    expect(MODULE_LOAD_ERRORS).toEqual([]);
    expect(MODULE_REGISTRY).toContainEqual({ id: 'harzsammler', version: '1.0.0' });
    expect(loaded?.manifest.building).toMatchObject({
      placement: { terrain: ['forest'], requiresRoadConnection: true },
      cost: { wood: 3, stone: 1 },
      buildTimeMs: WORLD_PULSE_MS,
      production: { resource: 'wood', amountPerPulse: 1 },
    });
    expect(loaded?.icon).toContain('<svg');
  });

  it('can be built on a connected forest and yields +1 wood per world pulse', () => {
    if (loaded === undefined) throw new Error('Harzsammler module is missing.');
    const terrain = (q: number): Terrain => (q === 2 ? 'forest' : 'meadow');
    const world: WorldSnapshot = {
      seed: 'harzsammler-seed',
      generatorVersion: 'module-test',
      radius: 4,
      tiles: Array.from({ length: 5 }, (_, q) => ({ coord: { q, r: 0 }, terrain: terrain(q), elevation: 1 })),
      village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
      visibleTileKeys: ['0,0', '1,0'],
      resourceSites: [],
      relaySite: { id: 'relay:local:4,0', tileKey: '4,0' },
      surfaceFinds: [],
    };
    let state = createInitialGameState(world, 0);
    for (const q of [1, 2]) {
      const road = buildRoad(state, { q, r: 0 });
      if (!road.ok) throw new Error(road.reason);
      state = road.state;
    }
    state = { ...state, resources: { wood: 10, stone: 5 } };

    const built = startModuleBuilding(state, loaded.manifest, { q: 2, r: 0 }, 0);
    if (!built.ok) throw new Error(built.reason);
    expect(built.state.resources).toEqual({ wood: 7, stone: 4 });
    expect(advanceTime(built.state, 4 * WORLD_PULSE_MS).resources.wood).toBe(7 + 4);
  });
});
