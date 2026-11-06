import type { CacheMeta } from './cache';

export interface ServerSave {
  readonly revision: number;
  readonly payload: string;
}

export type Decision =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'keep-local' }
  | { readonly kind: 'use-server'; readonly notice: string | null }
  | { readonly kind: 'import-anonymous' };

function lastAdvanced(raw: string | null): number {
  if (raw === null) return -1;
  try {
    const value = (JSON.parse(raw) as { lastAdvancedAtMs?: unknown }).lastAdvancedAtMs;
    return typeof value === 'number' && Number.isFinite(value) ? value : -1;
  } catch {
    return -1;
  }
}

function seedOf(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const seed = (JSON.parse(raw) as { world?: { seed?: unknown } }).world?.seed;
    return typeof seed === 'string' ? seed : null;
  } catch {
    return null;
  }
}

/**
 * Decides which save wins when a player signs in on this browser.
 * `server` is undefined when the server could not be reached.
 */
export function reconcile(input: {
  readonly local: string | null;
  readonly meta: CacheMeta;
  readonly server: ServerSave | null | undefined;
  readonly anonymous: string | null;
  readonly worldSeed: string;
}): Decision {
  const { local, meta, server, anonymous, worldSeed } = input;
  if (server === undefined) return local !== null ? { kind: 'keep-local' } : { kind: 'fresh' };
  if (server === null) {
    if (local !== null) return { kind: 'keep-local' };
    return seedOf(anonymous) === worldSeed ? { kind: 'import-anonymous' } : { kind: 'fresh' };
  }
  if (local === null || meta.baseRevision > server.revision) return { kind: 'use-server', notice: null };
  if (meta.baseRevision === server.revision) return { kind: 'keep-local' };
  // The server moved on since this cache was last synced (another browser played).
  if (!meta.dirty) {
    return { kind: 'use-server', notice: 'Neuerer Online-Spielstand aus einem anderen Browser geladen.' };
  }
  return lastAdvanced(local) > lastAdvanced(server.payload)
    ? { kind: 'keep-local' }
    : {
        kind: 'use-server',
        notice: 'Ein neuerer Online-Spielstand aus einem anderen Browser wurde geladen. Lokale Änderungen waren älter.',
      };
}
