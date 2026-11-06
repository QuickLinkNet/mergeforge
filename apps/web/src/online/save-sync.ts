import { GAME_SAVE_KEY, type StorageLike } from '../persistence';
import { request } from './api-client';
import { writeMeta } from './cache';
import type { ServerSave } from './reconcile';
import { API_BASE, type SyncStatus } from './types';

const PUSH_DELAY_MS = 3_000;
const RETRY_DELAY_MS = 15_000;
const REMOTE_CHECK_MS = 30_000;

/** Uploads the local cache to the server with an optimistic revision (D-017). */
export class SaveSync {
  private status: SyncStatus = 'synced';
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private remoteTimer: ReturnType<typeof setInterval> | undefined;
  private lastPushedRaw: string | null;
  private pushing = false;
  private stopped = false;

  constructor(
    private readonly fetcher: typeof fetch,
    private readonly base: StorageLike,
    private readonly cache: StorageLike,
    private readonly metaKey: string,
    private revision: number,
    initiallyOnline: boolean,
  ) {
    this.lastPushedRaw = null;
    if (!initiallyOnline) this.status = 'offline';
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  /** Call after every local save: marks the cache dirty and schedules an upload. */
  noteChange(): void {
    if (this.stopped || this.status === 'conflict') return;
    const raw = this.cache.getItem(GAME_SAVE_KEY);
    if (raw !== null && raw === this.lastPushedRaw) return;
    writeMeta(this.base, this.metaKey, { baseRevision: this.revision, dirty: true });
    this.schedule(PUSH_DELAY_MS);
  }

  private schedule(delayMs: number): void {
    if (this.pushTimer !== undefined) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.push(), delayMs);
  }

  /** Starts watching for newer saves from other browsers. */
  startWatching(): void {
    if (this.remoteTimer !== undefined) return;
    this.remoteTimer = setInterval(() => void this.checkRemote(), REMOTE_CHECK_MS);
  }

  stop(): void {
    this.stopped = true;
    if (this.pushTimer !== undefined) clearTimeout(this.pushTimer);
    if (this.remoteTimer !== undefined) clearInterval(this.remoteTimer);
  }

  async push(): Promise<void> {
    if (this.stopped || this.pushing || this.status === 'conflict') return;
    const raw = this.cache.getItem(GAME_SAVE_KEY);
    if (raw === null || raw === this.lastPushedRaw) {
      if (this.status !== 'offline') this.setStatus('synced');
      return;
    }
    this.pushing = true;
    this.setStatus('saving');
    try {
      const response = await request(this.fetcher, `${API_BASE}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision: this.revision, payload: raw }),
      });
      if (response.status === 409) {
        this.setStatus('conflict');
        return;
      }
      if (response.status === 401 || response.status === 403) {
        this.setStatus('offline');
        return;
      }
      const body = (await response.json()) as { ok?: boolean; revision?: unknown };
      if (!response.ok || body.ok !== true || typeof body.revision !== 'number') throw new Error('save rejected');
      this.revision = body.revision;
      this.lastPushedRaw = raw;
      const unchanged = this.cache.getItem(GAME_SAVE_KEY) === raw;
      writeMeta(this.base, this.metaKey, { baseRevision: this.revision, dirty: !unchanged });
      this.setStatus('synced');
      if (!unchanged) this.schedule(PUSH_DELAY_MS);
    } catch {
      this.setStatus('offline');
      this.schedule(RETRY_DELAY_MS);
    } finally {
      this.pushing = false;
    }
  }

  /** Looks for a newer server revision; flags a conflict if another browser saved. */
  async checkRemote(): Promise<void> {
    if (this.stopped || this.pushing || this.status === 'conflict') return;
    try {
      const response = await request(this.fetcher, `${API_BASE}/save?meta=1`);
      if (!response.ok) return;
      const body = (await response.json()) as { save?: { revision?: unknown } };
      if (typeof body.save?.revision === 'number' && body.save.revision > this.revision) this.setStatus('conflict');
      else if (this.status === 'offline') {
        this.setStatus('synced');
        this.schedule(0);
      }
    } catch {
      this.setStatus('offline');
    }
  }

  /** Replaces the local cache with the server save (used to resolve a conflict). */
  async adoptServer(): Promise<boolean> {
    try {
      const server = await fetchServerSave(this.fetcher);
      if (server === null || server === undefined) return false;
      this.cache.setItem(GAME_SAVE_KEY, server.payload);
      writeMeta(this.base, this.metaKey, { baseRevision: server.revision, dirty: false });
      return true;
    } catch {
      return false;
    }
  }
}

/** undefined = server unreachable, null = no save yet. */
export async function fetchServerSave(fetcher: typeof fetch): Promise<ServerSave | null | undefined> {
  try {
    const response = await request(fetcher, `${API_BASE}/save`);
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    const body = (await response.json()) as { save?: { revision?: unknown; payload?: unknown } };
    const save = body.save;
    return typeof save?.revision === 'number' && typeof save.payload === 'string'
      ? { revision: save.revision, payload: save.payload }
      : undefined;
  } catch {
    return undefined;
  }
}
