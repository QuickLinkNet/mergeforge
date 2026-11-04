import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessGate } from './AccessGate';
import { AdminPage } from './AdminPage';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const overview = {
  ok: true,
  access: [
    { githubUserId: 5, githubLogin: 'carol', status: 'pending', createdAt: '2026-11-04T10:00:00+00:00' },
    { githubUserId: 6, githubLogin: 'mallory', status: 'denied', createdAt: '2026-11-03T10:00:00+00:00' },
  ],
  players: [{ githubUserId: 1, githubLogin: 'owner', sectorIndex: 0 }],
};

describe('AdminPage', () => {
  it('lets the owner approve a request and invite by name', async () => {
    const calls: { url: string; body?: unknown }[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return jsonResponse(200, { ok: true });
      }
      return jsonResponse(200, overview);
    }) as unknown as typeof fetch;
    const view = render(<AdminPage fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText('carol')).toBeTruthy());

    fireEvent.click(screen.getAllByText('Freigeben')[0]!);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({ githubUserId: 5, githubLogin: 'carol', decision: 'approved' });

    fireEvent.change(screen.getByLabelText('GitHub-Name'), { target: { value: ' dave ' } });
    fireEvent.submit(screen.getByLabelText('GitHub-Name').closest('form')!);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]?.body).toEqual({ githubLogin: 'dave', decision: 'approved' });
    view.unmount();
  });

  it('refuses everyone but the owner', async () => {
    const fetcher = vi.fn(async () => jsonResponse(403, { ok: false })) as unknown as typeof fetch;
    const view = render(<AdminPage fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText(/nur für den Betreiber/)).toBeTruthy());
    view.unmount();
  });
});

describe('AccessGate join request', () => {
  it('sends the request and then shows that it is waiting', async () => {
    const fetcher = vi.fn(async () => jsonResponse(200, { ok: true, access: 'pending' })) as unknown as typeof fetch;
    const view = render(<AccessGate kind="not-contributor" login="eve" fetcher={fetcher} />);
    fireEvent.click(screen.getByText('Beitritt anfragen'));
    await waitFor(() => expect(screen.getByText(/wartet auf Freigabe/)).toBeTruthy());
    expect(screen.queryByText('Beitritt anfragen')).toBeNull();
    view.unmount();
  });

  it('shows a denial without a request button', () => {
    const view = render(<AccessGate kind="not-contributor" login="eve" access="denied" />);
    expect(screen.getByText(/abgelehnt/)).toBeTruthy();
    expect(screen.queryByText('Beitritt anfragen')).toBeNull();
    view.unmount();
  });
});
