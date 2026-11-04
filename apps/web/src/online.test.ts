import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_SAVE_KEY, type StorageLike } from './persistence';
import {
  SaveSync,
  UNIVERSE_SEED,
  prepareOnline,
  reconcile,
  scopedStorage,
  worldSeedForSector,
} from './online';

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const PLAYER = {
  playerId: `mf_${'a'.repeat(32)}`,
  githubLogin: 'alice',
  sectorIndex: 0,
  sector: { q: 0, r: 0 },
};
const save = (seed: string, advanced: number): string =>
  JSON.stringify({ formatVersion: 1, gameSchemaVersion: 7, world: { seed }, lastAdvancedAtMs: advanced });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A tiny in-memory server for /me and /save. */
function fakeServer(options: {
  player?: typeof PLAYER | null;
  save?: { revision: number; payload: string } | null;
  stranger?: boolean;
}) {
  const state = { save: options.save ?? null, puts: [] as { baseRevision: number; payload: string }[] };
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith('/me')) {
      if (options.player === null) return json(401, { ok: false });
      if (options.stranger === true) return json(200, { ok: true, account: { githubLogin: 'eve', contributor: false } });
      return json(200, { ok: true, account: { githubLogin: 'alice', contributor: true }, player: options.player ?? PLAYER });
    }
    if (url.includes('/save') && method === 'GET') {
      if (state.save === null) return json(404, { ok: false, error: 'no-save' });
      return json(200, { ok: true, save: url.includes('meta=1') ? { revision: state.save.revision } : state.save });
    }
    if (url.endsWith('/save') && method === 'PUT') {
      const body = JSON.parse(String(init?.body)) as { baseRevision: number; payload: string };
      state.puts.push(body);
      const current = state.save?.revision ?? 0;
      if (body.baseRevision !== current) return json(409, { ok: false, error: 'conflict', revision: current });
      state.save = { revision: current + 1, payload: body.payload };
      return json(200, { ok: true, revision: current + 1 });
    }
    return json(404, { ok: false });
  }) as unknown as typeof fetch & { mock: unknown };
  return { fetcher, state };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('sector worlds', () => {
  it('keeps the genesis seed for sector 0 and derives distinct seeds elsewhere', () => {
    expect(worldSeedForSector({ q: 0, r: 0 })).toBe(UNIVERSE_SEED);
    const other = worldSeedForSector({ q: -1, r: 1 });
    expect(other).not.toBe(UNIVERSE_SEED);
    expect(other).toBe(worldSeedForSector({ q: -1, r: 1 }));
  });

  it('scopes only the game save key', () => {
    const base = new MemoryStorage();
    const scoped = scopedStorage(base, 'cache-key');
    scoped.setItem(GAME_SAVE_KEY, 'x');
    scoped.setItem('other', 'y');
    expect(base.getItem('cache-key')).toBe('x');
    expect(base.getItem(GAME_SAVE_KEY)).toBeNull();
    expect(base.getItem('other')).toBe('y');
    scoped.removeItem(GAME_SAVE_KEY);
    expect(base.getItem('cache-key')).toBeNull();
  });
});

describe('reconcile', () => {
  const clean = { baseRevision: 3, dirty: false };
  const base = { local: save('s', 10), meta: clean, anonymous: null, worldSeed: 's' };

  it('starts fresh without any save', () => {
    expect(reconcile({ ...base, local: null, server: null })).toEqual({ kind: 'fresh' });
  });

  it('imports a matching anonymous save only when the account has nothing', () => {
    expect(reconcile({ ...base, local: null, server: null, anonymous: save('s', 5) })).toEqual({ kind: 'import-anonymous' });
    expect(reconcile({ ...base, local: null, server: null, anonymous: save('other', 5) })).toEqual({ kind: 'fresh' });
    expect(reconcile({ ...base, local: null, server: { revision: 1, payload: 'p' }, anonymous: save('s', 5) }).kind).toBe('use-server');
  });

  it('takes the server save when the cache is empty', () => {
    expect(reconcile({ ...base, local: null, server: { revision: 2, payload: 'p' } }).kind).toBe('use-server');
  });

  it('keeps the cache when it is based on the current server revision', () => {
    expect(reconcile({ ...base, server: { revision: 3, payload: 'p' } })).toEqual({ kind: 'keep-local' });
  });

  it('prefers a newer server save over a clean cache', () => {
    const decision = reconcile({ ...base, server: { revision: 4, payload: save('s', 99) } });
    expect(decision.kind).toBe('use-server');
  });

  it('resolves a real conflict by the more recently played state', () => {
    const dirty = { baseRevision: 3, dirty: true };
    expect(reconcile({ ...base, meta: dirty, server: { revision: 4, payload: save('s', 5) } })).toEqual({ kind: 'keep-local' });
    expect(reconcile({ ...base, meta: dirty, server: { revision: 4, payload: save('s', 50) } }).kind).toBe('use-server');
    expect(reconcile({ ...base, meta: dirty, server: { revision: 4, payload: save('s', 10) } }).kind).toBe('use-server');
  });

  it('works from the cache when the server is unreachable', () => {
    expect(reconcile({ ...base, server: undefined })).toEqual({ kind: 'keep-local' });
    expect(reconcile({ ...base, local: null, server: undefined })).toEqual({ kind: 'fresh' });
  });
});

describe('prepareOnline', () => {
  async function online(fetcher: typeof fetch, base: MemoryStorage) {
    const result = await prepareOnline(fetcher, base);
    if (result.kind !== 'online') throw new Error(`expected online, got ${result.kind}`);
    return result.session;
  }

  it('keeps strangers out: signed out, not a contributor, or API unreachable', async () => {
    expect(await prepareOnline(fakeServer({ player: null }).fetcher, new MemoryStorage())).toEqual({ kind: 'signed-out' });
    expect(await prepareOnline(fakeServer({ stranger: true }).fetcher, new MemoryStorage())).toEqual({ kind: 'not-contributor', login: 'eve', access: 'none' });
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await prepareOnline(failing, new MemoryStorage())).toEqual({ kind: 'unreachable' });
  });

  it('copies the server save into the player cache', async () => {
    const server = fakeServer({ save: { revision: 5, payload: save(UNIVERSE_SEED, 7) } });
    const base = new MemoryStorage();
    const session = await online(server.fetcher, base);
    expect(session.worldSeed).toBe(UNIVERSE_SEED);
    expect(session.storage.getItem(GAME_SAVE_KEY)).toBe(save(UNIVERSE_SEED, 7));
    expect(base.getItem(GAME_SAVE_KEY)).toBeNull();
    session.sync.stop();
  });

  it('moves the anonymous browser save into the account and uploads it', async () => {
    const server = fakeServer({ save: null });
    const base = new MemoryStorage();
    base.setItem(GAME_SAVE_KEY, save(UNIVERSE_SEED, 42));
    const session = await online(server.fetcher, base);
    expect(session.notice).toContain('übernommen');
    await vi.advanceTimersByTimeAsync(3_100);
    expect(server.state.puts).toHaveLength(1);
    expect(server.state.puts[0]?.baseRevision).toBe(0);
    expect(server.state.save?.payload).toBe(save(UNIVERSE_SEED, 42));
    expect(base.getItem(GAME_SAVE_KEY)).toBe(save(UNIVERSE_SEED, 42));
    session.sync.stop();
  });

  it('gives a second player a different sector world', async () => {
    const second = { ...PLAYER, playerId: `mf_${'b'.repeat(32)}`, sectorIndex: 1, sector: { q: -1, r: 1 } };
    const session = await online(fakeServer({ player: second, save: null }).fetcher, new MemoryStorage());
    expect(session.worldSeed).not.toBe(UNIVERSE_SEED);
    session.sync.stop();
  });
});

describe('SaveSync', () => {
  function setup(serverSave: { revision: number; payload: string } | null) {
    const server = fakeServer({ save: serverSave });
    const base = new MemoryStorage();
    const cache = scopedStorage(base, 'cache');
    const sync = new SaveSync(server.fetcher, base, cache, 'meta', serverSave?.revision ?? 0, true);
    return { server, base, cache, sync };
  }

  it('uploads a changed save after a short delay and tracks the revision', async () => {
    const { server, cache, sync } = setup(null);
    const states: string[] = [];
    sync.subscribe((status) => states.push(status));
    cache.setItem(GAME_SAVE_KEY, save('s', 1));
    sync.noteChange();
    expect(server.state.puts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3_100);
    expect(server.state.puts).toHaveLength(1);
    expect(sync.getStatus()).toBe('synced');
    expect(states).toEqual(['saving', 'synced']);

    cache.setItem(GAME_SAVE_KEY, save('s', 2));
    sync.noteChange();
    await vi.advanceTimersByTimeAsync(3_100);
    expect(server.state.puts.map((put) => put.baseRevision)).toEqual([0, 1]);
    sync.stop();
  });

  it('does not upload an unchanged save twice', async () => {
    const { server, cache, sync } = setup(null);
    cache.setItem(GAME_SAVE_KEY, save('s', 1));
    sync.noteChange();
    await vi.advanceTimersByTimeAsync(3_100);
    sync.noteChange();
    await vi.advanceTimersByTimeAsync(3_100);
    expect(server.state.puts).toHaveLength(1);
    sync.stop();
  });

  it('stops saving and reports a conflict when another browser saved first', async () => {
    const { server, cache, sync } = setup({ revision: 1, payload: save('s', 1) });
    server.state.save = { revision: 2, payload: save('s', 9) };
    cache.setItem(GAME_SAVE_KEY, save('s', 3));
    sync.noteChange();
    await vi.advanceTimersByTimeAsync(3_100);
    expect(sync.getStatus()).toBe('conflict');
    cache.setItem(GAME_SAVE_KEY, save('s', 4));
    sync.noteChange();
    await vi.advanceTimersByTimeAsync(3_100);
    expect(server.state.puts).toHaveLength(1);

    expect(await sync.adoptServer()).toBe(true);
    expect(cache.getItem(GAME_SAVE_KEY)).toBe(save('s', 9));
    sync.stop();
  });

  it('notices a newer server revision while idle', async () => {
    const { server, sync } = setup({ revision: 1, payload: save('s', 1) });
    await sync.checkRemote();
    expect(sync.getStatus()).toBe('synced');
    server.state.save = { revision: 2, payload: save('s', 2) };
    await sync.checkRemote();
    expect(sync.getStatus()).toBe('conflict');
    sync.stop();
  });

  it('goes offline on network errors and retries later', async () => {
    const base = new MemoryStorage();
    const cache = scopedStorage(base, 'cache');
    const down = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const sync = new SaveSync(down, base, cache, 'meta', 0, true);
    cache.setItem(GAME_SAVE_KEY, save('s', 1));
    sync.noteChange();
    await vi.advanceTimersByTimeAsync(3_100);
    expect(sync.getStatus()).toBe('offline');
    await vi.advanceTimersByTimeAsync(15_100);
    expect((down as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(2);
    sync.stop();
  });
});
