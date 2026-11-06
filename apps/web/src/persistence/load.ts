import {
  GAME_STATE_SCHEMA_VERSION,
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  findMissingModules,
  isVillageBuilding,
  type GameState,
  type ModuleManifest,
  type ModuleRef,
  type WorldSnapshot,
} from '@mergeforge/domain';
import {
  isConnectedRoadNetwork,
  isRecord,
  parseResources,
  parseTileKeys,
  parseTimestamp,
} from './guards';
import { parseBuildings, parseModules, parseUnits } from './parse-entities';
import {
  parseInventory,
  parsePrologue,
  parseRelay,
  parseSignals,
  parseSignalwerk,
} from './parse-progress';
import {
  GAME_SAVE_KEY,
  MIGRATABLE_SCHEMA_VERSION,
  PRE_MODULE_SCHEMA_VERSION,
  PRE_SINKS_SCHEMA_VERSION,
  SAVE_FORMAT_VERSION,
  type LoadGameResult,
  type StorageLike,
} from './schema';
import { hasConsistentSinks } from './validate-sinks';

export function loadGame(
  storage: StorageLike,
  world: WorldSnapshot,
  moduleRegistry: readonly ModuleRef[] = [],
  moduleManifests: readonly ModuleManifest[] = [],
): LoadGameResult {
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
  const migratingLegacy = value.gameSchemaVersion === MIGRATABLE_SCHEMA_VERSION;
  const preSinksSchema = value.gameSchemaVersion !== GAME_STATE_SCHEMA_VERSION;
  if (
    value.formatVersion !== SAVE_FORMAT_VERSION ||
    (value.gameSchemaVersion !== GAME_STATE_SCHEMA_VERSION &&
      value.gameSchemaVersion !== PRE_SINKS_SCHEMA_VERSION &&
      value.gameSchemaVersion !== PRE_MODULE_SCHEMA_VERSION &&
      !migratingLegacy)
  ) {
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
  const buildings = parseBuildings(value.buildings, tileByKey, stoneSiteKeys, villageTileKey, !preSinksSchema);
  const surveyTent = buildings?.find((building) => building.type === 'survey-tent');
  const maxCharges = surveyTent?.status === 'active'
    ? PATHFINDER_EXPANDED_MAX_CHARGES
    : PATHFINDER_BASE_MAX_CHARGES;
  const units = parseUnits(value.units, tileByKey, new Set(roadTileKeys ?? []), villageTileKey, maxCharges);
  const prologue = parsePrologue(value.prologue);
  const signalwerk = parseSignalwerk(value.signalwerk, world);
  const inventory = parseInventory(value.inventory);
  const relay = parseRelay(value.relay, migratingLegacy);
  const signals = migratingLegacy && value.signals === undefined ? [] : parseSignals(value.signals, world);
  const preModuleSchema = migratingLegacy || value.gameSchemaVersion === PRE_MODULE_SCHEMA_VERSION;
  const modules = preModuleSchema && value.modules === undefined ? [] : parseModules(value.modules);
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
    relay === null ||
    signals === null ||
    modules === null ||
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
  if (buildings.some((building) => !isVillageBuilding(building) && !roads.has(building.tileKey))) {
    return reset(storage, 'corrupt');
  }
  if (surveyTent !== undefined && units[0]?.status !== 'active') return reset(storage, 'corrupt');
  const activeTimedOrders = buildings.filter((building) => building.status === 'constructing').length
    + units.filter((unit) => unit.status === 'training').length
    + Number(relay.status === 'repairing');
  if (activeTimedOrders > 1) return reset(storage, 'corrupt');
  const tentActive = surveyTent?.status === 'active';
  const relayVisible = visible.has(world.relaySite.tileKey);
  if (
    (prologue.completedChapterIds.includes(3) &&
      (!prologue.stoneProductionObserved || prologue.pathfinderSurveysCompleted < 1)) ||
    (prologue.completedChapterIds.includes(4) && (roadTileKeys.length < 8 || !tentActive)) ||
    (prologue.eventIds.includes('relay_discovered') && !relayVisible) ||
    (prologue.completedChapterIds.includes(5) &&
      (!relayVisible || !prologue.eventIds.includes('relay_discovered'))) ||
    (prologue.completedChapterIds.includes(6) && relay.status !== 'active')
  ) return reset(storage, 'corrupt');
  const signalwerkEvent = prologue.eventIds.includes('signalwerk_solved');
  const relayEvent = prologue.eventIds.includes('relay_repaired');
  const workshop = buildings.find((building) => building.type === 'workshop');
  if (
    signalwerk.solved !== signalwerkEvent ||
    (signalwerk.solved && !prologue.completedChapterIds.includes(5)) ||
    (!signalwerk.solved && (inventory.resonanceCore !== 0 || workshop !== undefined || relay.status !== 'dormant')) ||
    (signalwerk.solved && Number(inventory.resonanceCore === 1) + Number(relay.coreInstalled) !== 1) ||
    (relay.status !== 'dormant' && (workshop?.status !== 'active' || !relayVisible)) ||
    (relay.status === 'active') !== relayEvent ||
    (relay.status === 'active') !== prologue.completedChapterIds.includes(6)
  ) return reset(storage, 'corrupt');

  const state: GameState = {
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
    relay,
    signals,
    modules,
    lastAdvancedAtMs,
  };
  // A schema-5 game is migrated without side effects: chapter 7 is never
  // granted on load, the player still has to scan for the far signals.
  const chapterSeven = state.prologue.completedChapterIds.includes(7);
  const signalEvent = state.prologue.eventIds.includes('first_signals_received');
  const capability = state.relay.status !== 'dormant' && state.relay.capabilities.includes('signal_network_active');
  if (
    chapterSeven !== signalEvent ||
    chapterSeven !== capability ||
    chapterSeven !== (state.signals.length > 0) ||
    (chapterSeven && (state.relay.status !== 'active' || !state.prologue.completedChapterIds.includes(6)))
  ) return reset(storage, 'corrupt');
  // Schema 7 saves migrate with storehouse level 0 and no upgrades (rejected above if present).
  if (!hasConsistentSinks(state)) return reset(storage, 'corrupt');

  // Every module building must be covered by a module reference of the same version.
  const moduleBuildings = state.buildings.filter((building) => building.type === 'module');
  if (
    moduleBuildings.some(
      (building) =>
        !state.modules.some((ref) => ref.id === building.moduleId && ref.version === building.moduleVersion),
    )
  ) return reset(storage, 'corrupt');

  // A valid save that needs modules this build lacks is blocked, never reset or rewritten.
  const missing = findMissingModules(state.modules, moduleRegistry);
  if (missing.length > 0) return { kind: 'blocked', missing };

  // Where the manifest is known, the frozen rule and the placement must still match it.
  for (const building of moduleBuildings) {
    const manifest = moduleManifests.find(
      (entry) => entry.id === building.moduleId && entry.version === building.moduleVersion,
    );
    if (manifest === undefined) continue;
    const tile = tileByKey.get(building.tileKey);
    if (
      tile === undefined ||
      !manifest.building.placement.terrain.includes(tile.terrain) ||
      (manifest.building.placement.requiresRoadConnection && !state.roadTileKeys.includes(building.tileKey)) ||
      building.production.resource !== manifest.building.production.resource ||
      building.production.amountPerPulse !== manifest.building.production.amountPerPulse
    ) return reset(storage, 'corrupt');
  }

  return { kind: 'loaded', state };
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
