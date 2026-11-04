import { API_BASE } from './online';

const REPO_URL = 'https://github.com/QuickLinkNet/mergeforge';
const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;

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
  notice = null,
}: {
  readonly kind: AccessGateKind;
  readonly login?: string;
  readonly notice?: string | null;
}) {
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
              Hallo <strong>{login}</strong>, du bist angemeldet, aber noch kein Contributor. Sobald ein Pull
              Request von dir gemergt wurde, melde dich hier erneut an und das Spiel öffnet sich.
            </p>
            <div className="access-actions">
              <a className="access-primary" href={CONTRIBUTING_URL} target="_blank" rel="noreferrer">So wirst du Contributor</a>
              <a href={`${API_BASE}/auth/login`}>Erneut prüfen</a>
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
