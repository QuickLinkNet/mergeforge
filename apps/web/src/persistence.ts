import {
  GAME_STATE_SCHEMA_VERSION,
  MAX_STONE_STORAGE,
  MAX_WOOD_STORAGE,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  type Building,
  type GameState,
  type ResourceStock,
  type Unit,
  type WorldSnapshot,
} from '@mergeforge/domain';
import {
  createSignalwerkPuzzle,
  isSignalwerkSolved,
  type SignalRotation,
} from '@mergeforge/signalwerk';

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
  readonly gameSchemaVersion: typeof GAME_STATE_SCHEMA_VERSION;
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
  readonly units: readonly Unit[];
  readonly prologue: GameState['prologue'];
  readonly signalwerk: GameState['signalwerk'];
  readonly inventory: GameState['inventory'];
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
    units: state.units,
    prologue: state.prologue,
    signalwerk: state.signalwerk,
    inventory: state.inventory,
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
  const stoneSiteKeys = new Set(
    world.resourceSites.filter((site) => site.type === 'stone').map((site) => site.tileKey),
  );
  const explicitFindKeys = new Set(world.surfaceFinds.map((find) => find.tileKey));
  const resources = parseResources(value.resources);
  const roadTileKeys = parseTileKeys(value.roadTileKeys, tileByKey);
  const visibleTileKeys = parseTileKeys(value.visibleTileKeys, tileByKey);
  const claimedSurfaceFindTileKeys = parseTileKeys(value.claimedSurfaceFindTileKeys, tileByKey);
  const villageTileKey = `${world.village.coord.q},${world.village.coord.r}`;
  const buildings = parseBuildings(value.buildings, tileByKey, stoneSiteKeys, villageTileKey);
  const surveyTent = buildings?.find((building) => building.type === 'survey-tent');
  const maxCharges = surveyTent?.status === 'active'
    ? PATHFINDER_EXPANDED_MAX_CHARGES
    : PATHFINDER_BASE_MAX_CHARGES;
  const units = parseUnits(value.units, tileByKey, new Set(roadTileKeys ?? []), villageTileKey, maxCharges);
  const prologue = parsePrologue(value.prologue);
  const signalwerk = parseSignalwerk(value.signalwerk, world);
  const inventory = parseInventory(value.inventory);
  const lastAdvancedAtMs = parseTimestamp(value.lastAdvancedAtMs);

  if (
    resources === null ||
    roadTileKeys === null ||
    visibleTileKeys === null ||
    claimedSurfaceFindTileKeys === null ||
    buildings === null ||
    units === null ||
    prologue === null ||
    signalwerk === null ||
    inventory === null ||
    lastAdvancedAtMs === null
  ) {
    return reset(storage, 'corrupt');
  }

  const visible = new Set(visibleTileKeys);
  const roads = new Set(roadTileKeys);
  if (roadTileKeys.some((key) => !visible.has(key))) return reset(storage, 'corrupt');
  if (!isConnectedRoadNetwork(roads, villageTileKey, tileByKey)) return reset(storage, 'corrupt');
  if (claimedSurfaceFindTileKeys.some((key) => !visible.has(key))) return reset(storage, 'corrupt');
  if (
    claimedSurfaceFindTileKeys.some(
      (key) => tileByKey.get(key)?.terrain !== 'forest' && !explicitFindKeys.has(key),
    )
  ) {
    return reset(storage, 'corrupt');
  }
  if (buildings.some((building) => building.type !== 'survey-tent' && !roads.has(building.tileKey))) {
    return reset(storage, 'corrupt');
  }
  if (surveyTent !== undefined && units[0]?.status !== 'active') return reset(storage, 'corrupt');
  const activeTimedOrders = buildings.filter((building) => building.status === 'constructing').length
    + units.filter((unit) => unit.status === 'training').length;
  if (activeTimedOrders > 1) return reset(storage, 'corrupt');
  const tentActive = surveyTent?.status === 'active';
  const relayVisible = visible.has(world.relaySite.tileKey);
  if (
    (prologue.completedChapterIds.includes(3) &&
      (!prologue.stoneProductionObserved || prologue.pathfinderSurveysCompleted < 1)) ||
    (prologue.completedChapterIds.includes(4) && (roadTileKeys.length < 8 || !tentActive)) ||
    (prologue.eventIds.includes('relay_discovered') && !relayVisible) ||
    (prologue.completedChapterIds.includes(5) &&
      (!relayVisible || !prologue.eventIds.includes('relay_discovered')))
  ) return reset(storage, 'corrupt');
  const signalwerkEvent = prologue.eventIds.includes('signalwerk_solved');
  if (
    signalwerk.solved !== signalwerkEvent ||
    signalwerk.solved !== (inventory.resonanceCore === 1) ||
    (signalwerk.solved && !prologue.completedChapterIds.includes(5))
  ) return reset(storage, 'corrupt');

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
      units,
      prologue,
      signalwerk,
      inventory,
      lastAdvancedAtMs,
    },
  };
}

function parseResources(value: unknown): ResourceStock | null {
  if (!isRecord(value) || !isCount(value.wood) || !isCount(value.stone)) return null;
  if (value.wood > MAX_WOOD_STORAGE || value.stone > MAX_STONE_STORAGE) return null;
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
  stoneSiteKeys: ReadonlySet<string>,
  villageTileKey: string,
): readonly Building[] | null {
  if (!Array.isArray(value)) return null;
  const buildings: Building[] = [];
  const ids = new Set<string>();
  const tileKeys = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const startedAtMs = parseTimestamp(candidate.startedAtMs);
    const completesAtMs = parseTimestamp(candidate.completesAtMs);
    if (
      typeof candidate.id !== 'string' ||
      (candidate.type !== 'lumber-camp' && candidate.type !== 'quarry' && candidate.type !== 'survey-tent') ||
      typeof candidate.tileKey !== 'string' ||
      (candidate.status !== 'constructing' && candidate.status !== 'active') ||
      startedAtMs === null ||
      completesAtMs === null ||
      ids.has(candidate.id) ||
      tileKeys.has(candidate.tileKey)
    ) {
      return null;
    }
    const tile = tileByKey.get(candidate.tileKey);
    if (
      tile === undefined ||
      completesAtMs < startedAtMs ||
      (candidate.type === 'lumber-camp' && tile.terrain !== 'forest') ||
      (candidate.type === 'quarry' && !stoneSiteKeys.has(candidate.tileKey)) ||
      (candidate.type === 'survey-tent' && candidate.tileKey !== villageTileKey)
    ) {
      return null;
    }

    ids.add(candidate.id);
    tileKeys.add(candidate.tileKey);
    if (candidate.type === 'survey-tent') {
      buildings.push({
        id: candidate.id,
        type: 'survey-tent',
        tileKey: candidate.tileKey,
        status: candidate.status,
        startedAtMs,
        completesAtMs,
      });
    } else {
      const lastProductionAtMs = parseTimestamp(candidate.lastProductionAtMs);
      if (lastProductionAtMs === null) return null;
      buildings.push({
        id: candidate.id,
        type: candidate.type,
        tileKey: candidate.tileKey,
        status: candidate.status,
        startedAtMs,
        completesAtMs,
        lastProductionAtMs,
      });
    }
  }
  return buildings;
}

function parseUnits(
  value: unknown,
  tileByKey: ReadonlyMap<string, WorldSnapshot['tiles'][number]>,
  roadTileKeys: ReadonlySet<string>,
  villageTileKey: string,
  maxCharges: number,
): readonly Unit[] | null {
  if (!Array.isArray(value) || value.length > 1) return null;
  const units: Unit[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const startedAtMs = parseTimestamp(candidate.startedAtMs);
    const completesAtMs = parseTimestamp(candidate.completesAtMs);
    const lastChargeAtMs = parseTimestamp(candidate.lastChargeAtMs);
    if (
      typeof candidate.id !== 'string' ||
      candidate.type !== 'pathfinder' ||
      (candidate.status !== 'training' && candidate.status !== 'active') ||
      typeof candidate.tileKey !== 'string' ||
      !tileByKey.has(candidate.tileKey) ||
      !isCount(candidate.charges) ||
      candidate.charges > maxCharges ||
      startedAtMs === null ||
      completesAtMs === null ||
      lastChargeAtMs === null ||
      completesAtMs < startedAtMs ||
      (candidate.status === 'training' && candidate.tileKey !== villageTileKey) ||
      (candidate.status === 'active' && candidate.tileKey !== villageTileKey && !roadTileKeys.has(candidate.tileKey))
    ) return null;
    units.push({
      id: candidate.id,
      type: 'pathfinder',
      status: candidate.status,
      tileKey: candidate.tileKey,
      charges: candidate.charges,
      startedAtMs,
      completesAtMs,
      lastChargeAtMs,
    });
  }
  return units;
}

function parsePrologue(value: unknown): GameState['prologue'] | null {
  if (
    !isRecord(value) ||
    typeof value.stoneProductionObserved !== 'boolean' ||
    !isCount(value.pathfinderSurveysCompleted) ||
    !Array.isArray(value.completedChapterIds) ||
    !Array.isArray(value.eventIds)
  ) return null;

  const completedChapterIds = value.completedChapterIds;
  const eventIds = value.eventIds;
  if (
    completedChapterIds.some((chapter) => chapter !== 3 && chapter !== 4 && chapter !== 5) ||
    eventIds.some((eventId) => eventId !== 'relay_discovered' && eventId !== 'signalwerk_solved') ||
    new Set(completedChapterIds).size !== completedChapterIds.length ||
    new Set(eventIds).size !== eventIds.length
  ) return null;

  const completedSequence = completedChapterIds.join(',');
  if (!['', '3', '3,4', '3,4,5'].includes(completedSequence)) return null;
  const eventSequence = eventIds.join(',');
  if (!['', 'relay_discovered', 'relay_discovered,signalwerk_solved'].includes(eventSequence)) {
    return null;
  }

  return {
    stoneProductionObserved: value.stoneProductionObserved,
    pathfinderSurveysCompleted: value.pathfinderSurveysCompleted,
    completedChapterIds: [...completedChapterIds] as (3 | 4 | 5)[],
    eventIds: [...eventIds] as ('relay_discovered' | 'signalwerk_solved')[],
  };
}

function parseSignalwerk(
  value: unknown,
  world: WorldSnapshot,
): GameState['signalwerk'] | null {
  const expectedSeed = `${world.seed}:signalwerk:${world.relaySite.tileKey}`;
  if (
    !isRecord(value) ||
    value.seed !== expectedSeed ||
    !Array.isArray(value.rotations) ||
    value.rotations.length !== 25 ||
    value.rotations.some((rotation) =>
      rotation !== 0 && rotation !== 1 && rotation !== 2 && rotation !== 3
    ) ||
    typeof value.solved !== 'boolean'
  ) return null;
  const rotations = [...value.rotations] as SignalRotation[];
  const puzzle = createSignalwerkPuzzle(expectedSeed);
  if (isSignalwerkSolved(puzzle, rotations) !== value.solved) return null;
  return { seed: expectedSeed, rotations, solved: value.solved };
}

function parseInventory(value: unknown): GameState['inventory'] | null {
  if (!isRecord(value) || (value.resonanceCore !== 0 && value.resonanceCore !== 1)) return null;
  return { resonanceCore: value.resonanceCore };
}

function parseTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isConnectedRoadNetwork(
  roadTileKeys: ReadonlySet<string>,
  villageTileKey: string,
  tileByKey: ReadonlyMap<string, WorldSnapshot['tiles'][number]>,
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
