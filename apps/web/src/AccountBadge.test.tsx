import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountBadge } from './AccountBadge';

function reply(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

afterEach(cleanup);

describe('AccountBadge', () => {
  it('offers the GitHub login when signed out', async () => {
    render(<AccountBadge fetcher={reply(401, { ok: false })} />);
    const link = await screen.findByRole('link', { name: 'Mit GitHub anmelden' });
    expect(link.getAttribute('href')).toBe('./api/auth/login');
  });

  it('shows the player and signs out', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      return new Response(
        JSON.stringify({ ok: true, player: { playerId: `mf_${'a'.repeat(32)}`, githubLogin: 'alice', sector: { q: 0, r: 0 } } }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    render(<AccountBadge fetcher={fetcher} />);
    expect(await screen.findByText('alice')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    await screen.findByRole('link', { name: 'Mit GitHub anmelden' });
    expect(calls).toEqual(['GET ./api/me', 'POST ./api/auth/logout']);
  });

  it('stays hidden when the API is unreachable or answers nonsense', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const { container, rerender } = render(<AccountBadge fetcher={failing} />);
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(container.querySelector('.account-badge')).toBeNull();

    rerender(<AccountBadge fetcher={reply(200, { ok: true, player: { nope: 1 } })} />);
    await waitFor(() => expect(container.querySelector('.account-badge')).toBeNull());
  });
});
