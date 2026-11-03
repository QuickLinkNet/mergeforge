import { useEffect, useState } from 'react';
import { App } from './App';
import { prepareOnline, type OnlineSession } from './online';

type GateState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly online: OnlineSession | undefined };

/** Finds out first whether a player is signed in, then starts the game in the right mode. */
export function OnlineGate({ fetcher = fetch }: { readonly fetcher?: typeof fetch }) {
  const [state, setState] = useState<GateState>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    const start = storage === undefined ? Promise.resolve(null) : prepareOnline(fetcher, storage);
    start
      .catch(() => null)
      .then((online) => {
        if (!cancelled) setState({ kind: 'ready', online: online ?? undefined });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  if (state.kind === 'checking') {
    return <main className="game-shell" aria-busy="true" aria-label="MERGEFORGE wird geladen" />;
  }
  return <App online={state.online} />;
}
