import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from './online';

interface AccessRow {
  readonly githubUserId: number;
  readonly githubLogin: string;
  readonly status: 'pending' | 'approved' | 'denied';
  readonly createdAt: string;
}

interface PlayerRow {
  readonly githubUserId: number;
  readonly githubLogin: string;
  readonly sectorIndex: number;
}

interface Overview {
  readonly access: readonly AccessRow[];
  readonly players: readonly PlayerRow[];
}

type Load =
  | { readonly kind: 'loading' }
  | { readonly kind: 'denied'; readonly reason: 'signed-out' | 'not-owner' | 'error' }
  | { readonly kind: 'ready'; readonly overview: Overview };

const STATUS_LABEL: Readonly<Record<AccessRow['status'], string>> = {
  pending: 'wartet',
  approved: 'freigegeben',
  denied: 'abgelehnt',
};

/** Owner-only page (#admin): decide on access requests, invite people by GitHub name (D-019). */
export function AdminPage({ fetcher = fetch }: { readonly fetcher?: typeof fetch }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [invite, setInvite] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetcher(`${API_BASE}/admin/overview`, { credentials: 'same-origin' });
      if (response.status === 401) return setLoad({ kind: 'denied', reason: 'signed-out' });
      if (response.status === 403) return setLoad({ kind: 'denied', reason: 'not-owner' });
      if (!response.ok) return setLoad({ kind: 'denied', reason: 'error' });
      const body = (await response.json()) as Overview;
      setLoad({ kind: 'ready', overview: { access: body.access ?? [], players: body.players ?? [] } });
    } catch {
      setLoad({ kind: 'denied', reason: 'error' });
    }
  }, [fetcher]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(payload: Record<string, unknown>): Promise<void> {
    setMessage(null);
    try {
      const response = await fetcher(`${API_BASE}/admin/decide`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 404) setMessage('Diesen GitHub-Namen gibt es nicht.');
      else if (!response.ok) setMessage('Das hat nicht geklappt.');
      else setInvite('');
    } catch {
      setMessage('Server nicht erreichbar.');
    }
    await refresh();
  }

  const leave = (): void => {
    window.location.hash = '';
    window.location.reload();
  };

  if (load.kind === 'loading') return <main className="access-gate" aria-busy="true" />;
  if (load.kind === 'denied') {
    return (
      <main className="access-gate" aria-label="MERGEFORGE Admin">
        <section className="access-card">
          <h1>Admin</h1>
          <p>
            {load.reason === 'signed-out' && 'Bitte melde dich zuerst an.'}
            {load.reason === 'not-owner' && 'Dieser Bereich ist nur für den Betreiber.'}
            {load.reason === 'error' && 'Der Server antwortet gerade nicht.'}
          </p>
          <div className="access-actions">
            {load.reason === 'signed-out' && <a className="access-primary" href={`${API_BASE}/auth/login`}>Mit GitHub anmelden</a>}
            <button type="button" onClick={leave}>Zurück</button>
          </div>
        </section>
      </main>
    );
  }

  const { access, players } = load.overview;
  const pending = access.filter((row) => row.status === 'pending');
  const decided = access.filter((row) => row.status !== 'pending');

  return (
    <main className="access-gate admin" aria-label="MERGEFORGE Admin">
      <section className="access-card admin-card">
        <h1>Admin</h1>
        {message !== null && <p className="access-notice" role="alert">{message}</p>}

        <h2>Anfragen ({pending.length})</h2>
        {pending.length === 0 && <p className="admin-empty">Keine offenen Anfragen.</p>}
        <ul className="admin-list">
          {pending.map((row) => (
            <li key={row.githubUserId}>
              <strong>{row.githubLogin}</strong>
              <span className="admin-buttons">
                <button type="button" className="access-primary" onClick={() => void decide({ githubUserId: row.githubUserId, githubLogin: row.githubLogin, decision: 'approved' })}>Freigeben</button>
                <button type="button" onClick={() => void decide({ githubUserId: row.githubUserId, githubLogin: row.githubLogin, decision: 'denied' })}>Ablehnen</button>
              </span>
            </li>
          ))}
        </ul>

        <h2>Person einladen</h2>
        <form
          className="admin-invite"
          onSubmit={(event) => {
            event.preventDefault();
            if (invite.trim() !== '') void decide({ githubLogin: invite.trim(), decision: 'approved' });
          }}
        >
          <input value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="GitHub-Name" aria-label="GitHub-Name" />
          <button type="submit" className="access-primary">Freigeben</button>
        </form>

        <h2>Entscheidungen</h2>
        {decided.length === 0 && <p className="admin-empty">Noch keine.</p>}
        <ul className="admin-list">
          {decided.map((row) => (
            <li key={row.githubUserId}>
              <span><strong>{row.githubLogin}</strong> ({STATUS_LABEL[row.status]})</span>
              <span className="admin-buttons">
                {row.status === 'denied'
                  ? <button type="button" onClick={() => void decide({ githubUserId: row.githubUserId, githubLogin: row.githubLogin, decision: 'approved' })}>Freigeben</button>
                  : <button type="button" onClick={() => void decide({ githubUserId: row.githubUserId, githubLogin: row.githubLogin, decision: 'denied' })}>Sperren</button>}
              </span>
            </li>
          ))}
        </ul>

        <h2>Spieler ({players.length})</h2>
        <ul className="admin-list">
          {players.map((player) => (
            <li key={player.githubUserId}>
              <span><strong>{player.githubLogin}</strong> · Sektor {player.sectorIndex}</span>
              {player.githubLogin !== '' && (
                <span className="admin-buttons">
                  <button type="button" onClick={() => void decide({ githubUserId: player.githubUserId, githubLogin: player.githubLogin, decision: 'denied' })}>Sperren</button>
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="access-actions">
          <button type="button" onClick={leave}>Zum Spiel</button>
        </div>
      </section>
    </main>
  );
}
