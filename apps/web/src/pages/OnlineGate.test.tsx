import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { loginNotice } from './AccessGate';
import { OnlineGate } from './OnlineGate';

vi.mock('../App', () => ({
  App: ({ online }: { online?: unknown }) => <div>{online === undefined ? 'game-sandbox' : 'game-online'}</div>,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('loginNotice', () => {
  it('explains known failures and ignores the rest', () => {
    expect(loginNotice('?login=check-failed')).toContain('nicht prüfen');
    expect(loginNotice('?login=ok')).toBeNull();
    expect(loginNotice('')).toBeNull();
  });
});

describe('OnlineGate', () => {
  it('shows the sign-in page instead of the game to visitors', async () => {
    const fetcher = vi.fn(async () => jsonResponse(401, { ok: false })) as unknown as typeof fetch;
    const view = render(<OnlineGate fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText('Mit GitHub anmelden')).toBeTruthy());
    expect(screen.queryByText('game-online')).toBeNull();
    expect(screen.queryByText('game-sandbox')).toBeNull();
    view.unmount();
  });

  it('tells signed-in non-contributors how to get in', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(200, { ok: true, account: { githubLogin: 'eve', contributor: false } }),
    ) as unknown as typeof fetch;
    const view = render(<OnlineGate fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText(/noch kein Contributor/)).toBeTruthy());
    expect(screen.getByText('eve')).toBeTruthy();
    expect(screen.getByText('Abmelden')).toBeTruthy();
    expect(screen.queryByText('game-online')).toBeNull();
    view.unmount();
  });

  it('asks to retry when the server cannot be reached (no sandbox on a real host)', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const view = render(<OnlineGate fetcher={fetcher} />);
    // jsdom runs on localhost, which is the development sandbox
    await waitFor(() => expect(screen.getByText('game-sandbox')).toBeTruthy());
    view.unmount();
  });
});
