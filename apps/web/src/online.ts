import { SIGNAL_BEARINGS, TRADE_MAX_AMOUNT, TRADE_RESOURCES, sectorSeed, type SectorCoord, type SignalBearing } from '@mergeforge/domain';
import { GAME_SAVE_KEY, type StorageLike } from './persistence';

/** The API sits next to the page (relative URL), on the subdomain and under /apps/mergeforge alike. */
export const API_BASE = './api';
/** Seed of the first sector; also the seed of the offline/anonymous sandbox. */
export const UNIVERSE_SEED = 'mergeforge-genesis-001';

const PUSH_DELAY_MS = 3_000;
const RETRY_DELAY_MS = 15_000;
const REMOTE_CHECK_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

export interface AccountPlayer {
  readonly playerId: string;
  readonly githubLogin: string;
  readonly sectorIndex: number;
  readonly sector: SectorCoord;
}

/** A real neighbour: only compass bearing and a coarse distance class (no coordinates). */
export interface RadioContact {
  readonly login: string;
  readonly bearing: SignalBearing;
  readonly distanceBand: 'near' | 'middle' | 'far';
}

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'conflict';

export interface OnlineSession {
  readonly player: AccountPlayer;
  readonly worldSeed: string;
  /** Storage for this player's cache; it answers to GAME_SAVE_KEY like the anonymous one. */
  readonly storage: StorageLike;
  readonly sync: SaveSync;
  readonly notice: string | null;
  /** Real neighbouring players (best effort: an empty list when the server cannot say). */
  readonly loadContacts?: () => Promise<readonly RadioContact[]>;
  /** Trade offers with the neighbours (D-021). */
  readonly market?: MarketApi;
  /** The maintainer account: may use the test tools (fast-forward). */
  readonly isOwner?: boolean;
}

export type TradeResourceId = (typeof TRADE_RESOURCES)[number];

export interface MarketOffer {
  readonly id: number;
  readonly seller: string;
  readonly giveResource: TradeResourceId;
  readonly giveAmount: number;
  readonly wantResource: TradeResourceId;
  readonly wantAmount: number;
}

export interface MarketDelivery {
  readonly id: number;
  readonly resource: TradeResourceId;
  readonly amount: number;
  readonly reason: 'sale' | 'purchase' | 'refund';
  readonly counterpart: string;
}

export interface MarketOverview {
  readonly offers: readonly MarketOffer[];
  readonly mine: readonly MarketOffer[];
  readonly inbox: readonly MarketDelivery[];
}

export type MarketResult<T extends object = object> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly error: string };

export interface MarketApi {
  overview(): Promise<MarketOverview | null>;
  createOffer(offer: Omit<MarketOffer, 'id' | 'seller'>): Promise<MarketResult>;
  accept(offerId: number): Promise<MarketResult>;
  cancel(offerId: number): Promise<MarketResult>;
  claim(ids: readonly number[]): Promise<MarketResult<{ claimed: readonly { id: number; resource: TradeResourceId; amount: number }[] }>>;
}

const isTradeResource = (value: unknown): value is TradeResourceId =>
  typeof value === 'string' && (TRADE_RESOURCES as readonly string[]).includes(value);
const isTradeAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= TRADE_MAX_AMOUNT;

function parseOffers(list: unknown): MarketOffer[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: unknown) => {
    const o = entry as Record<string, unknown> | null;
    if (
      typeof o?.id !== 'number' ||
      typeof o.seller !== 'string' ||
      !isTradeResource(o.giveResource) ||
      !isTradeResource(o.wantResource) ||
      !isTradeAmount(o.giveAmount) ||
      !isTradeAmount(o.wantAmount)
    ) {
      return [];
    }
    return [{ id: o.id, seller: o.seller, giveResource: o.giveResource, giveAmount: o.giveAmount, wantResource: o.wantResource, wantAmount: o.wantAmount }];
  });
}

/** Keeps only well-formed parts of a /market answer. */
export function parseMarketOverview(body: unknown): MarketOverview | null {
  const data = body as { ok?: unknown; offers?: unknown; mine?: unknown; inbox?: unknown } | null;
  if (data === null || data.ok !== true) return null;
  const inbox = Array.isArray(data.inbox)
    ? data.inbox.flatMap((entry: unknown) => {
        const d = entry as Record<string, unknown> | null;
        if (
          typeof d?.id !== 'number' ||
          !isTradeResource(d.resource) ||
          typeof d.amount !== 'number' ||
          !Number.isInteger(d.amount) ||
          d.amount < 1 ||
          (d.reason !== 'sale' && d.reason !== 'purchase' && d.reason !== 'refund')
        ) {
          return [];
        }
        return [{ id: d.id, resource: d.resource, amount: d.amount, reason: d.reason as MarketDelivery['reason'], counterpart: typeof d.counterpart === 'string' ? d.counterpart : '' }];
      })
    : [];
  return { offers: parseOffers(data.offers), mine: parseOffers(data.mine), inbox };
}

export function createMarketApi(fetcher: typeof fetch): MarketApi {
  const post = async (path: string, body: unknown): Promise<Record<string, unknown> & { ok: boolean }> => {
    try {
      const response = await request(fetcher, `${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as Record<string, unknown>;
      return { ...data, ok: response.ok && data.ok === true };
    } catch {
      return { ok: false, error: 'unreachable' };
    }
  };
  const failure = (data: Record<string, unknown>): { ok: false; error: string } => ({
    ok: false,
    error: typeof data.error === 'string' ? data.error : 'unreachable',
  });
  return {
    async overview() {
      try {
        const response = await request(fetcher, `${API_BASE}/market`);
        return response.ok ? parseMarketOverview(await response.json()) : null;
      } catch {
        return null;
      }
    },
    async createOffer(offer) {
      const data = await post('/market/offers', offer);
      return data.ok ? { ok: true } : failure(data);
    },
    async accept(offerId) {
      const data = await post('/market/accept', { offerId });
      return data.ok ? { ok: true } : failure(data);
    },
    async cancel(offerId) {
      const data = await post('/market/cancel', { offerId });
      return data.ok ? { ok: true } : failure(data);
    },
    async claim(ids) {
      const data = await post('/market/claim', { ids });
      if (!data.ok || !Array.isArray(data.claimed)) return failure(data);
      const claimed = data.claimed.flatMap((entry: unknown) => {
        const c = entry as Record<string, unknown> | null;
        return typeof c?.id === 'number' && isTradeResource(c.resource) && isTradeAmount(c.amount) ? [{ id: c.id, resource: c.resource, amount: c.amount }] : [];
      });
      return { ok: true, claimed };
    },
  };
}

/** Keeps only well-formed contacts from a /neighbors answer. */
export function parseContacts(body: unknown): RadioContact[] {
  const list = (body as { contacts?: unknown } | null)?.contacts;
  if (!Array.isArray(list)) return [];
  const bands = ['near', 'middle', 'far'];
  return list.flatMap((entry: unknown) => {
    const item = entry as { login?: unknown; bearing?: unknown; distanceBand?: unknown } | null;
    if (
      typeof item?.login !== 'string' ||
      typeof item.bearing !== 'string' ||
      !(SIGNAL_BEARINGS as readonly string[]).includes(item.bearing) ||
      typeof item.distanceBand !== 'string' ||
      !bands.includes(item.distanceBand)
    ) {
      return [];
    }
    return [{ login: item.login, bearing: item.bearing as SignalBearing, distanceBand: item.distanceBand as RadioContact['distanceBand'] }];
  });
}

export async function fetchContacts(fetcher: typeof fetch): Promise<RadioContact[]> {
  try {
    const response = await request(fetcher, `${API_BASE}/neighbors`);
    return response.ok ? parseContacts(await response.json()) : [];
  } catch {
    return [];
  }
}

/** Sector (0,0) keeps the original genesis seed so existing saves stay valid. */
export function worldSeedForSector(sector: SectorCoord): string {
  return sector.q === 0 && sector.r === 0 ? UNIVERSE_SEED : sectorSeed(UNIVERSE_SEED, sector);
}

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

function readMeta(storage: StorageLike, metaKey: string): CacheMeta {
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

function writeMeta(storage: StorageLike, metaKey: string, meta: CacheMeta): void {
  try {
    storage.setItem(metaKey, JSON.stringify(meta));
  } catch {
    // the cache is best effort; the server copy is what counts
  }
}

async function request(fetcher: typeof fetch, url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(url, { credentials: 'same-origin', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
async function fetchServerSave(fetcher: typeof fetch): Promise<ServerSave | null | undefined> {
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

function isPlayer(value: unknown): value is AccountPlayer {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const sector = candidate.sector as Record<string, unknown> | undefined;
  return (
    typeof candidate.playerId === 'string' &&
    typeof candidate.githubLogin === 'string' &&
    typeof sector?.q === 'number' &&
    typeof sector.r === 'number'
  );
}

/** How this browser may start (D-018: playing is for contributors only). */
export type GateResult =
  | { readonly kind: 'online'; readonly session: OnlineSession }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'not-contributor'; readonly login: string; readonly access: AccessRequestStatus }
  | { readonly kind: 'unreachable' };

/** What the owner decided about a person who asked to join (D-019). */
export type AccessRequestStatus = 'none' | 'pending' | 'denied';

/**
 * Decides how this browser starts: online as the signed-in contributor with that
 * player's sector world and server-backed save, or not at all (sign in / not a
 * contributor / server unreachable).
 */
export async function prepareOnline(fetcher: typeof fetch, base: StorageLike): Promise<GateResult> {
  let player: AccountPlayer;
  let isOwner = false;
  try {
    const response = await request(fetcher, `${API_BASE}/me`);
    if (response.status === 401) return { kind: 'signed-out' };
    if (!response.ok) return { kind: 'unreachable' };
    const body = (await response.json()) as {
      account?: { githubLogin?: unknown; contributor?: unknown; access?: unknown; owner?: unknown };
      player?: unknown;
    };
    isOwner = body.account?.owner === true;
    if (body.account?.contributor === false) {
      const login = body.account.githubLogin;
      const access = body.account.access;
      return {
        kind: 'not-contributor',
        login: typeof login === 'string' ? login : '',
        access: access === 'pending' || access === 'denied' ? access : 'none',
      };
    }
    if (!isPlayer(body.player)) return { kind: 'unreachable' };
    player = body.player;
  } catch {
    return { kind: 'unreachable' };
  }

  const worldSeed = worldSeedForSector(player.sector);
  const cacheKey = `mergeforge.online.${player.playerId}.game`;
  const metaKey = `mergeforge.online.${player.playerId}.meta`;
  const cache = scopedStorage(base, cacheKey);
  const server = await fetchServerSave(fetcher);
  let local: string | null = null;
  let anonymous: string | null = null;
  try {
    local = cache.getItem(GAME_SAVE_KEY);
    anonymous = base.getItem(GAME_SAVE_KEY);
  } catch {
    // unreadable storage behaves like an empty one
  }
  const meta = readMeta(base, metaKey);
  const decision = reconcile({ local, meta, server, anonymous, worldSeed });

  let notice: string | null = null;
  let revision = meta.baseRevision;
  if (decision.kind === 'use-server' && server !== undefined && server !== null) {
    cache.setItem(GAME_SAVE_KEY, server.payload);
    revision = server.revision;
    writeMeta(base, metaKey, { baseRevision: revision, dirty: false });
    notice = decision.notice;
  } else if (decision.kind === 'import-anonymous' && anonymous !== null) {
    cache.setItem(GAME_SAVE_KEY, anonymous);
    revision = 0;
    writeMeta(base, metaKey, { baseRevision: 0, dirty: true });
    notice = 'Dein bisheriger Browser-Spielstand wurde in dein Konto übernommen.';
  } else if (decision.kind === 'keep-local' && server !== undefined) {
    // Cache is at least as new as the server (or the server has nothing yet); upload if dirty.
    revision = server === null ? 0 : server.revision;
    writeMeta(base, metaKey, { baseRevision: revision, dirty: true });
  }

  const sync = new SaveSync(fetcher, base, cache, metaKey, revision, server !== undefined);
  sync.startWatching();
  const needsUpload =
    decision.kind === 'import-anonymous' ||
    (decision.kind === 'keep-local' && (meta.dirty || server === null || server === undefined));
  if (needsUpload) sync.noteChange();
  return {
    kind: 'online',
    session: {
      player,
      worldSeed,
      storage: cache,
      sync,
      notice,
      loadContacts: () => fetchContacts(fetcher),
      market: createMarketApi(fetcher),
      isOwner,
    },
  };
}
