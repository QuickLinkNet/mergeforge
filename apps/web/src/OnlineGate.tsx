import { useEffect, useState } from 'react';
import { AccessGate, loginNotice } from './AccessGate';
import { AdminPage } from './AdminPage';
import { App } from './App';
import { prepareOnline, type GateResult } from './online';

type GateState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly result: GateResult }
  /** Local development without an API: the anonymous sandbox, never on a real host. */
  | { readonly kind: 'dev-sandbox' };

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * Finds out first whether a contributor is signed in, then starts the game.
 * Without a sign-in there is no game: visitors see the access page (D-018).
 */
export function OnlineGate({ fetcher = fetch }: { readonly fetcher?: typeof fetch }) {
  const [state, setState] = useState<GateState>({ kind: 'checking' });
  const adminRequested = window.location.hash === '#admin';

  // The page decides between game and admin once per load, so a changed hash reloads it.
  useEffect(() => {
    const reload = (): void => window.location.reload();
    window.addEventListener('hashchange', reload);
    return () => window.removeEventListener('hashchange', reload);
  }, []);

  useEffect(() => {
    if (adminRequested) return undefined;
    let cancelled = false;
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    const start: Promise<GateResult> =
      storage === undefined ? Promise.resolve({ kind: 'unreachable' }) : prepareOnline(fetcher, storage);
    start
      .catch((): GateResult => ({ kind: 'unreachable' }))
      .then((result) => {
        if (cancelled) return;
        setState(
          result.kind === 'unreachable' && isLocalDevHost(window.location.hostname)
            ? { kind: 'dev-sandbox' }
            : { kind: 'ready', result },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, adminRequested]);

  if (adminRequested) return <AdminPage fetcher={fetcher} />;
  if (state.kind === 'checking') {
    return <main className="game-shell" aria-busy="true" aria-label="MERGEFORGE wird geladen" />;
  }
  if (state.kind === 'dev-sandbox') return <App />;

  const { result } = state;
  if (result.kind === 'online') return <App online={result.session} />;
  const notice = loginNotice(window.location.search);
  return result.kind === 'not-contributor'
    ? <AccessGate kind="not-contributor" login={result.login} access={result.access} notice={notice} />
    : <AccessGate kind={result.kind} notice={notice} />;
}
