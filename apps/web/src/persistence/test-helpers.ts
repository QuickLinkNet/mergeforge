import {
  PATHFINDER_TRAINING_MS,
  advanceTime,
  buildRoad,
  createInitialGameState,
  startLumberCamp,
  startPathfinderTraining,
  startQuarry,
  type WorldSnapshot,
} from '@mergeforge/domain';
import type { StorageLike } from './schema';

/** Shared fixtures for the persistence tests (not part of the public barrel). */
export class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

export const world: WorldSnapshot = {
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

export function stateWithLumberCamp() {
  const road = buildRoad(createInitialGameState(world, 1_000), { q: 1, r: 0 });
  if (!road.ok) throw new Error(road.reason);
  const camp = startLumberCamp(road.state, { q: 1, r: 0 }, 2_000);
  if (!camp.ok) throw new Error(camp.reason);
  return camp.state;
}

export function stateWithQuarry() {
  const road = buildRoad(createInitialGameState(world, 1_000), { q: 0, r: 1 });
  if (!road.ok) throw new Error(road.reason);
  const quarry = startQuarry(road.state, { q: 0, r: 1 }, 2_000);
  if (!quarry.ok) throw new Error(quarry.reason);
  return quarry.state;
}

export function stateWithActivePathfinder() {
  const started = startPathfinderTraining(createInitialGameState(world, 1_000), 2_000);
  if (!started.ok) throw new Error(started.reason);
  return advanceTime(started.state, 2_000 + PATHFINDER_TRAINING_MS);
}
