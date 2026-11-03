/**
 * Player identity and start sectors (D-002).
 *
 * Pure registry logic for the later online backend. A player is keyed by the
 * stable numeric GitHub user ID; the internal MERGEFORGE ID is assigned once
 * and never changes, the GitHub login is display metadata only. Every player
 * gets their own start sector on a spiral of sector coordinates, so two
 * players never share a world.
 */

const PLAYER_ID_PATTERN = /^mf_[0-9a-f]{32}$/;
const SECTOR_DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export interface SectorCoord {
  readonly q: number;
  readonly r: number;
}

export interface PlayerRecord {
  /** Internal immutable ID, assigned by the server on first login. */
  readonly playerId: string;
  /** Stable numeric GitHub user ID; the identity link. */
  readonly githubUserId: number;
  /** Display metadata only; may change at any login. */
  readonly githubLogin: string;
  readonly sector: SectorCoord;
  readonly sectorIndex: number;
}

export interface PlayerRegistry {
  readonly players: readonly PlayerRecord[];
}

export type RegisterPlayerRejection = "invalid-github-user" | "invalid-player-id" | "player-id-taken";

export type RegisterPlayerResult =
  | { readonly ok: true; readonly registry: PlayerRegistry; readonly player: PlayerRecord; readonly created: boolean }
  | { readonly ok: false; readonly reason: RegisterPlayerRejection; readonly registry: PlayerRegistry };

export const EMPTY_PLAYER_REGISTRY: PlayerRegistry = { players: [] };

export function isValidPlayerId(value: unknown): value is string {
  return typeof value === "string" && PLAYER_ID_PATTERN.test(value);
}

/** Sector for a running index: ring 0 is the origin, ring k holds 6k sectors. */
export function sectorForIndex(index: number): SectorCoord {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError("Sector index must be a non-negative safe integer.");
  }
  if (index === 0) return { q: 0, r: 0 };

  let ring = 1;
  let remaining = index - 1;
  while (remaining >= 6 * ring) {
    remaining -= 6 * ring;
    ring += 1;
  }

  let q = -ring;
  let r = ring;
  const side = Math.floor(remaining / ring);
  for (let walked = 0; walked < side; walked += 1) {
    const [dq, dr] = SECTOR_DIRECTIONS[walked] as readonly [number, number];
    q += dq * ring;
    r += dr * ring;
  }
  const [dq, dr] = SECTOR_DIRECTIONS[side] as readonly [number, number];
  const step = remaining % ring;
  return { q: q + dq * step, r: r + dr * step };
}

/** World seed of one sector; distinct sectors always yield distinct seeds. */
export function sectorSeed(universeSeed: string, sector: SectorCoord): string {
  return `${universeSeed}|sector|${sector.q},${sector.r}`;
}

/**
 * Finds the player for a GitHub user or registers a new one in the next free
 * sector. Known users keep their ID and sector; only the login is refreshed.
 * `newPlayerId` is supplied by the caller (the server) and used only for new players.
 */
export function registerPlayer(
  registry: PlayerRegistry,
  githubUserId: number,
  githubLogin: string,
  newPlayerId: string,
): RegisterPlayerResult {
  if (!Number.isSafeInteger(githubUserId) || githubUserId < 1 || githubLogin.trim() === "") {
    return { ok: false, reason: "invalid-github-user", registry };
  }

  const known = registry.players.find((player) => player.githubUserId === githubUserId);
  if (known !== undefined) {
    const player = known.githubLogin === githubLogin ? known : { ...known, githubLogin };
    return {
      ok: true,
      created: false,
      player,
      registry:
        player === known
          ? registry
          : { players: registry.players.map((entry) => (entry === known ? player : entry)) },
    };
  }

  if (!isValidPlayerId(newPlayerId)) return { ok: false, reason: "invalid-player-id", registry };
  if (registry.players.some((player) => player.playerId === newPlayerId)) {
    return { ok: false, reason: "player-id-taken", registry };
  }

  const sectorIndex = registry.players.length;
  const player: PlayerRecord = {
    playerId: newPlayerId,
    githubUserId,
    githubLogin,
    sector: sectorForIndex(sectorIndex),
    sectorIndex,
  };
  return { ok: true, created: true, player, registry: { players: [...registry.players, player] } };
}
