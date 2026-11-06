import { GAME_SAVE_KEY, type StorageLike } from '../persistence';

/** A view of `base` in which GAME_SAVE_KEY is stored under another key. */
export function scopedStorage(base: StorageLike, saveKey: string): StorageLike {
  const map = (key: string): string => (key === GAME_SAVE_KEY ? saveKey : key);
  return {
    getItem: (key) => base.getItem(map(key)),
    setItem: (key, value) => base.setItem(map(key), value),
    removeItem: (key) => base.removeItem(map(key)),
  };
}

export interface CacheMeta {
  /** Server revision this cache is based on (0 = never synced). */
  readonly baseRevision: number;
  /** True while the cache holds changes the server has not seen. */
  readonly dirty: boolean;
}

export function readMeta(storage: StorageLike, metaKey: string): CacheMeta {
  try {
    const value = JSON.parse(storage.getItem(metaKey) ?? 'null') as Partial<CacheMeta> | null;
    if (value !== null && Number.isInteger(value.baseRevision) && (value.baseRevision as number) >= 0) {
      return { baseRevision: value.baseRevision as number, dirty: value.dirty === true };
    }
  } catch {
    // fall through to the default
  }
  return { baseRevision: 0, dirty: false };
}

export function writeMeta(storage: StorageLike, metaKey: string, meta: CacheMeta): void {
  try {
    storage.setItem(metaKey, JSON.stringify(meta));
  } catch {
    // the cache is best effort; the server copy is what counts
  }
}
