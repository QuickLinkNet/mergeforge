import { GAME_STATE_SCHEMA_VERSION, type GameState } from '@mergeforge/domain';
import { GAME_SAVE_KEY, SAVE_FORMAT_VERSION, type PersistedStateV1, type StorageLike } from './schema';

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
    relay: state.relay,
    signals: state.signals,
    modules: state.modules,
    lastAdvancedAtMs: state.lastAdvancedAtMs,
  };

  try {
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
