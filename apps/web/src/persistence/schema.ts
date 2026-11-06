import {
  GAME_STATE_SCHEMA_VERSION,
  type Building,
  type FarSignal,
  type GameState,
  type ModuleRef,
  type ResourceStock,
  type Unit,
  type WorldSnapshot,
} from '@mergeforge/domain';

export const GAME_SAVE_KEY = 'mergeforge.game.v1';
export const SAVE_FORMAT_VERSION = 1;
/** Schema 5 (before chapter 7) is migrated on load instead of being discarded. */
export const MIGRATABLE_SCHEMA_VERSION = 5;
/** Schema 6 (before module references) is migrated by defaulting to no modules. */
export const PRE_MODULE_SCHEMA_VERSION = 6;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadGameResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loaded'; readonly state: GameState }
  | { readonly kind: 'reset'; readonly reason: 'corrupt' | 'incompatible' }
  /** The save is valid but needs modules this build does not provide; it is left untouched. */
  | { readonly kind: 'blocked'; readonly missing: readonly ModuleRef[] };

export interface PersistedStateV1 {
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
  readonly relay: GameState['relay'];
  readonly signals: readonly FarSignal[];
  readonly modules: readonly ModuleRef[];
  readonly lastAdvancedAtMs: number;
}

/** Lookup of world tiles by their "q,r" key, shared by the parsers. */
export type TileByKey = ReadonlyMap<string, WorldSnapshot['tiles'][number]>;
