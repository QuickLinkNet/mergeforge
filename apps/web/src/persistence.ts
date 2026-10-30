import {
  GAME_STATE_SCHEMA_VERSION,
  type Building,
  type GameState,
  type ResourceStock,
  type WorldSnapshot,
} from '@mergeforge/domain';

export const GAME_SAVE_KEY = 'mergeforge.game.v1';
const SAVE_FORMAT_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadGameResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loaded'; readonly state: GameState }
  | { readonly kind: 'reset'; readonly reason: 'corrupt' | 'incompatible' };

interface PersistedStateV1 {
  readonly formatVersion: 1;
  readonly gameSchemaVersion: 1;
  readonly world: {
    readonly seed: string;
    readonly generatorVersion: string;
    readonly radius: number;
  };
  readonly resources: ResourceStock;
  readonly roadTileKeys: readonly string[];
  readonly visibleTileKeys: readonly string[];
  readonly claimedSurfaceFindTileKeys: readonly string[];
  readonly buildings: readonly Building[];
  readonly lastAdvancedAtMs: number;
}

export function saveGame(storage: StorageLike, state: GameState): boolean {
  const payload: PersistedStateV1 = {
    formatVersion: SAVE_FORMAT_VERSION,
    gameSchemaVersion: GAME_STATE_SCHEMA_VERSION,
    world: {
      seed: state.world.seed,
      generatorVersion: state.world.generatorVersion,
      radius: state.world.radius,
    },
    resources: state.resources,
    roadTileKeys: state.roadTileKeys,
    visibleTileKeys: state.visibleTileKeys,
    claimedSurfaceFindTileKeys: state.claimedSurfaceFindTileKeys,
    buildings: state.buildings,
    lastAdvancedAtMs: state.lastAdvancedAtMs,
  };

  try {
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: StorageLike, world: WorldSnapshot): LoadGameResult {
  let raw: string | null;
  try {
    raw = storage.getItem(GAME_SAVE_KEY);
  } catch {
    return { kind: 'reset', reason: 'corrupt' };
  }
  if (raw === null) return { kind: 'empty' };

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    removeInvalidSave(storage);
    return { kind: 'reset', reason: 'corrupt' };
  }

  if (!isRecord(value)) return reset(storage, 'corrupt');
  if (value.formatVersion !== SAVE_FORMAT_VERSION || value.gameSchemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    return reset(storage, 'incompatible');
  }
  if (!isRecord(value.world)) return reset(storage, 'corrupt');
  if (
    value.world.seed !== world.seed ||
    value.world.generatorVersion !== world.generatorVersion ||
    value.world.radius !== world.radius
  ) {
    return reset(storage, 'incompatible');
  }

  const tileByKey = new Map<string, WorldSnapshot['tiles'][number]>(
    world.tiles.map((tile) => [`${tile.coord.q},${tile.coord.r}`, tile]),
  );
  const resources = parseResources(value.resources);
  const roadTileKeys = parseTileKeys(value.roadTileKeys, tileByKey);
  const visibleTileKeys = parseTileKeys(value.visibleTileKeys, tileByKey);
  const claimedSurfaceFindTileKeys = parseTileKeys(value.claimedSurfaceFindTileKeys, tileByKey);
  const buildings = parseBuildings(value.buildings, tileByKey);
  const lastAdvancedAtMs = parseTimestamp(value.lastAdvancedAtMs);

  if (
    resources === null ||
    roadTileKeys === null ||
    visibleTileKeys === null ||
    claimedSurfaceFindTileKeys === null ||
    buildings === null ||
    lastAdvancedAtMs === null
  ) {
    return reset(storage, 'corrupt');
  }

  const visible = new Set(visibleTileKeys);
  const roads = new Set(roadTileKeys);
  if (roadTileKeys.some((key) => !visible.has(key))) return reset(storage, 'corrupt');
  if (claimedSurfaceFindTileKeys.some((key) => !visible.has(key))) return reset(storage, 'corrupt');
  if (claimedSurfaceFindTileKeys.some((key) => tileByKey.get(key)?.terrain !== 'forest')) {
    return reset(storage, 'corrupt');
  }
  if (buildings.some((building) => !roads.has(building.tileKey))) return reset(storage, 'corrupt');

  return {
    kind: 'loaded',
    state: {
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      world,
      resources,
      roadTileKeys,
      visibleTileKeys,
      claimedSurfaceFindTileKeys,
      buildings,
      lastAdvancedAtMs,
    },
  };
}

function parseResources(value: unknown): ResourceStock | null {
  if (!isRecord(value) || !isCount(value.wood) || !isCount(value.stone)) return null;
  return { wood: value.wood, stone: value.stone };
}

function parseTileKeys(
  value: unknown,
  tileByKey: ReadonlyMap<string, WorldSnapshot['tiles'][number]>,
): readonly string[] | null {
  if (!Array.isArray(value) || value.some((key) => typeof key !== 'string' || !tileByKey.has(key))) {
    return null;
  }
  const keys = value as string[];
  return new Set(keys).size === keys.length ? [...keys] : null;
}

function parseBuildings(
  value: unknown,
  tileByKey: ReadonlyMap<string, WorldSnapshot['tiles'][number]>,
): readonly Building[] | null {
  if (!Array.isArray(value)) return null;
  const buildings: Building[] = [];
  const ids = new Set<string>();
  const tileKeys = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const startedAtMs = parseTimestamp(candidate.startedAtMs);
    const completesAtMs = parseTimestamp(candidate.completesAtMs);
    const lastProductionAtMs = parseTimestamp(candidate.lastProductionAtMs);
    if (
      typeof candidate.id !== 'string' ||
      candidate.type !== 'lumber-camp' ||
      typeof candidate.tileKey !== 'string' ||
      (candidate.status !== 'constructing' && candidate.status !== 'active') ||
      startedAtMs === null ||
      completesAtMs === null ||
      lastProductionAtMs === null ||
      ids.has(candidate.id) ||
      tileKeys.has(candidate.tileKey)
    ) {
      return null;
    }
    const tile = tileByKey.get(candidate.tileKey);
    if (tile?.terrain !== 'forest' || completesAtMs < startedAtMs) return null;

    ids.add(candidate.id);
    tileKeys.add(candidate.tileKey);
    buildings.push({
      id: candidate.id,
      type: 'lumber-camp',
      tileKey: candidate.tileKey,
      status: candidate.status,
      startedAtMs,
      completesAtMs,
      lastProductionAtMs,
    });
  }
  return buildings;
}

function parseTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reset(storage: StorageLike, reason: 'corrupt' | 'incompatible'): LoadGameResult {
  removeInvalidSave(storage);
  return { kind: 'reset', reason };
}

function removeInvalidSave(storage: StorageLike): void {
  try {
    storage.removeItem(GAME_SAVE_KEY);
  } catch {
    // The new in-memory game remains usable even when storage is unavailable.
  }
}
