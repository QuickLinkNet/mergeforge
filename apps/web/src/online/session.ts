import { sectorSeed, type SectorCoord } from '@mergeforge/domain';
import { GAME_SAVE_KEY, type StorageLike } from '../persistence';
import { request } from './api-client';
import { readMeta, scopedStorage, writeMeta } from './cache';
import { fetchContacts } from './contacts';
import { createMarketApi } from './market';
import { reconcile } from './reconcile';
import { SaveSync, fetchServerSave } from './save-sync';
import { API_BASE, UNIVERSE_SEED, type AccountPlayer, type GateResult } from './types';

/** Sector (0,0) keeps the original genesis seed so existing saves stay valid. */
export function worldSeedForSector(sector: SectorCoord): string {
  return sector.q === 0 && sector.r === 0 ? UNIVERSE_SEED : sectorSeed(UNIVERSE_SEED, sector);
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
