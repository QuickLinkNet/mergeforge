import { useState } from 'react';
import { API_BASE, type AccessRequestStatus } from './online';

const REPO_URL = 'https://github.com/QuickLinkNet/mergeforge';
const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTORS.md`;

export type AccessGateKind = 'signed-out' | 'not-contributor' | 'unreachable';

const LOGIN_NOTICES: Readonly<Record<string, string>> = {
  'check-failed': 'GitHub konnte deinen Beitrag gerade nicht prüfen. Bitte versuche es gleich noch einmal.',
  error: 'Die Anmeldung hat nicht geklappt. Bitte versuche es noch einmal.',
  denied: 'Die Anmeldung wurde abgebrochen.',
};

/** Message for the `?login=` result the API redirects back with, if it is a problem. */
export function loginNotice(search: string): string | null {
  const reason = new URLSearchParams(search).get('login');
  return reason === null ? null : LOGIN_NOTICES[reason] ?? null;
}

function signOut(): void {
  fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'same-origin' })
    .catch(() => undefined)
    .finally(() => window.location.assign('./'));
}

/** Shown instead of the game: playing is for contributors only (D-018). */
export function AccessGate({
  kind,
  login = '',
  access = 'none',
  notice = null,
  fetcher = fetch,
}: {
  readonly kind: AccessGateKind;
  readonly login?: string;
  readonly access?: AccessRequestStatus;
  readonly notice?: string | null;
  readonly fetcher?: typeof fetch;
}) {
  const [requested, setRequested] = useState<AccessRequestStatus>(access);
  const [failed, setFailed] = useState(false);

  function askToJoin(): void {
    setFailed(false);
    fetcher(`${API_BASE}/access/request`, { method: 'POST', credentials: 'same-origin' })
      .then(async (response) => {
        const body = (await response.json()) as { access?: unknown };
        if (!response.ok) throw new Error('request failed');
        setRequested(body.access === 'denied' ? 'denied' : 'pending');
      })
      .catch(() => setFailed(true));
  }

  return (
    <main className="access-gate" aria-label="MERGEFORGE Zugang">
      <section className="access-card">
        <h1>MERGEFORGE</h1>
        {notice !== null && <p className="access-notice" role="alert">{notice}</p>}

        {kind === 'signed-out' && (
          <>
            <p>
              Eine gemeinsam gebaute Hexwelt. Mitspielen dürfen <strong>Contributor</strong>: Wer einen Pull Request
              zum Projekt beigetragen hat, der gemergt wurde, bekommt Zugang. Wir prüfen deinen Beitrag nach der
              Anmeldung automatisch.
            </p>
            <div className="access-actions">
              <a className="access-primary" href={`${API_BASE}/auth/login`}>Mit GitHub anmelden</a>
              <a href={CONTRIBUTING_URL} target="_blank" rel="noreferrer">So wirst du Contributor</a>
            </div>
          </>
        )}

        {kind === 'not-contributor' && (
          <>
            <p>
              Hallo <strong>{login}</strong>, du bist angemeldet, aber noch kein Contributor.
              {requested === 'none' && ' Du kannst den Beitritt anfragen, der Betreiber gibt dich dann frei.'}
              {requested === 'pending' && ' Deine Anfrage ist angekommen und wartet auf Freigabe.'}
              {requested === 'denied' && ' Deine Anfrage wurde leider abgelehnt.'}
            </p>
            {failed && <p className="access-notice" role="alert">Die Anfrage ist nicht angekommen. Bitte versuche es noch einmal.</p>}
            <div className="access-actions">
              {requested === 'none' && (
                <button type="button" className="access-primary" onClick={askToJoin}>Beitritt anfragen</button>
              )}
              {requested === 'pending' && (
                <button type="button" className="access-primary" onClick={() => window.location.reload()}>Erneut prüfen</button>
              )}
              <a href={CONTRIBUTING_URL} target="_blank" rel="noreferrer">Oder werde Contributor per Pull Request</a>
              <button type="button" onClick={signOut}>Abmelden</button>
            </div>
          </>
        )}

        {kind === 'unreachable' && (
          <>
            <p>Der Server antwortet gerade nicht. Dein Spielstand ist sicher, bitte versuche es gleich noch einmal.</p>
            <div className="access-actions">
              <button type="button" className="access-primary" onClick={() => window.location.reload()}>Erneut versuchen</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
