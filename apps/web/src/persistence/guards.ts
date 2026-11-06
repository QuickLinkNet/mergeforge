import { MAX_STONE_STORAGE, MAX_WOOD_STORAGE, type ResourceStock } from '@mergeforge/domain';
import type { TileByKey } from './schema';

export function parseResources(value: unknown): ResourceStock | null {
  if (!isRecord(value) || !isCount(value.wood) || !isCount(value.stone)) return null;
  if (value.wood > MAX_WOOD_STORAGE || value.stone > MAX_STONE_STORAGE) return null;
  return { wood: value.wood, stone: value.stone };
}

export function parseTileKeys(
  value: unknown,
  tileByKey: TileByKey,
): readonly string[] | null {
  if (!Array.isArray(value) || value.some((key) => typeof key !== 'string' || !tileByKey.has(key))) {
    return null;
  }
  const keys = value as string[];
  return new Set(keys).size === keys.length ? [...keys] : null;
}

export function parseTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function isConnectedRoadNetwork(
  roadTileKeys: ReadonlySet<string>,
  villageTileKey: string,
  tileByKey: TileByKey,
): boolean {
  const reachedRoads = new Set<string>();
  const queue = [villageTileKey];
  const visited = new Set(queue);
  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (currentKey === undefined) break;
    const current = tileByKey.get(currentKey);
    if (current === undefined) return false;
    const { q, r } = current.coord;
    const neighborKeys = [
      `${q + 1},${r}`,
      `${q + 1},${r - 1}`,
      `${q},${r - 1}`,
      `${q - 1},${r}`,
      `${q - 1},${r + 1}`,
      `${q},${r + 1}`,
    ];
    for (const neighborKey of neighborKeys) {
      if (!roadTileKeys.has(neighborKey) || visited.has(neighborKey)) continue;
      visited.add(neighborKey);
      reachedRoads.add(neighborKey);
      queue.push(neighborKey);
    }
  }
  return reachedRoads.size === roadTileKeys.size;
}

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
