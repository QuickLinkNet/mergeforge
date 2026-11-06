import './ViewMessage.css';

export interface ViewMessageProps {
  readonly state: 'loading' | 'error';
  /** Bootstrap outcome: decides headline and button for a failed start. */
  readonly bootstrapOk: boolean;
  readonly blocked: boolean;
  readonly errorMessage: string;
}

/** Centered loading spinner or start error with a reload button. */
export function ViewMessage({ state, bootstrapOk, blocked, errorMessage }: ViewMessageProps) {
  return (
    <section className={`view-message ${state}`} role={state === 'error' ? 'alert' : 'status'}>
      {state === 'loading' ? (
        <><span className="loading-rune" aria-hidden="true" /><strong>Genesis wird kartiert</strong><span>Hex für Hex entsteht eure Welt …</span></>
      ) : (
        <><strong>{bootstrapOk ? 'Die Welt bleibt im Nebel' : blocked ? 'Spielstand gesperrt' : 'Die Welt bleibt im Nebel'}</strong><span>{errorMessage}</span><button type="button" onClick={() => window.location.reload()}>{bootstrapOk ? 'Ansicht neu laden' : blocked ? 'Erneut prüfen' : 'Ansicht neu laden'}</button></>
      )}
    </section>
  );
}
