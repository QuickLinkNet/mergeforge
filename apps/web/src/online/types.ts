import type { SectorCoord, SignalBearing } from '@mergeforge/domain';
import type { StorageLike } from '../persistence';
import type { MarketApi } from './market';
import type { SaveSync } from './save-sync';

/** The API sits next to the page (relative URL), on the subdomain and under /apps/mergeforge alike. */
export const API_BASE = './api';
/** Seed of the first sector; also the seed of the offline/anonymous sandbox. */
export const UNIVERSE_SEED = 'mergeforge-genesis-001';

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

/** How this browser may start (D-018: playing is for contributors only). */
export type GateResult =
  | { readonly kind: 'online'; readonly session: OnlineSession }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'not-contributor'; readonly login: string; readonly access: AccessRequestStatus }
  | { readonly kind: 'unreachable' };

/** What the owner decided about a person who asked to join (D-019). */
export type AccessRequestStatus = 'none' | 'pending' | 'denied';
