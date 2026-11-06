import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../../online';
import './AccountBadge.css';

export interface AccountPlayer {
  readonly playerId: string;
  readonly githubLogin: string;
  readonly sector: { readonly q: number; readonly r: number };
}

type AccountState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'signed-in'; readonly player: AccountPlayer; readonly owner: boolean };

function isPlayer(value: unknown): value is AccountPlayer {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.playerId === 'string' && typeof candidate.githubLogin === 'string';
}

/** GitHub sign-in status. Without a reachable API (local dev) it stays quiet. */
export function AccountBadge({ fetcher = fetch }: { readonly fetcher?: typeof fetch }) {
  const [account, setAccount] = useState<AccountState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetcher(`${API_BASE}/me`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setAccount({ kind: 'signed-out' });
          return;
        }
        const body: unknown = await response.json();
        const parsed = typeof body === 'object' && body !== null ? (body as { player?: unknown; account?: { owner?: unknown } }) : {};
        const owner = parsed.account?.owner === true;
        setAccount(response.ok && isPlayer(parsed.player) ? { kind: 'signed-in', player: parsed.player, owner } : { kind: 'offline' });
      })
      .catch(() => {
        if (!cancelled) setAccount({ kind: 'offline' });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  const signOut = useCallback(() => {
    fetcher(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' })
      .catch(() => undefined)
      .finally(() => setAccount({ kind: 'signed-out' }));
  }, [fetcher]);

  if (account.kind === 'loading' || account.kind === 'offline') return null;

  return (
    <div className="account-badge">
      {account.kind === 'signed-out' ? (
        <a className="account-link" href={`${API_BASE}/auth/login`}>Mit GitHub anmelden</a>
      ) : (
        <>
          <span>Angemeldet als <strong>{account.player.githubLogin}</strong></span>
          {account.owner && <a className="account-link" href="#admin">Admin</a>}
          <button type="button" className="account-link" onClick={signOut}>Abmelden</button>
        </>
      )}
    </div>
  );
}
