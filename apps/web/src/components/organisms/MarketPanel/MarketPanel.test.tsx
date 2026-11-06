import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '@mergeforge/domain';
import { MarketPanel } from './MarketPanel';
import { createMarketApi, parseMarketOverview, type MarketApi, type MarketOverview } from '../../../online';

// The storage limit comes from the buildings (no storehouse = base limit 300/150).
const stateWith = (wood: number, stone: number): GameState => ({ resources: { wood, stone }, buildings: [] }) as unknown as GameState;

function fakeMarket(overview: MarketOverview, extra: Partial<MarketApi> = {}): MarketApi {
  return {
    overview: vi.fn(async () => overview),
    createOffer: vi.fn(async () => ({ ok: true as const })),
    accept: vi.fn(async () => ({ ok: true as const })),
    cancel: vi.fn(async () => ({ ok: true as const })),
    claim: vi.fn(async (ids: readonly number[]) => ({
      ok: true as const,
      claimed: ids.map((id) => ({ id, resource: 'wood' as const, amount: 10 })),
    })),
    ...extra,
  };
}

const offer = { id: 7, seller: 'eve', giveResource: 'wood', giveAmount: 10, wantResource: 'stone', wantAmount: 4 } as const;

describe('parseMarketOverview', () => {
  it('keeps only well-formed entries', () => {
    const parsed = parseMarketOverview({
      ok: true,
      offers: [offer, { ...offer, id: 8, giveResource: 'gold' }, { ...offer, id: 9, giveAmount: 500 }],
      mine: [],
      inbox: [
        { id: 1, resource: 'wood', amount: 5, reason: 'sale', counterpart: 'eve' },
        { id: 2, resource: 'wood', amount: 5, reason: 'gift', counterpart: '' },
      ],
    });
    expect(parsed?.offers).toEqual([offer]);
    expect(parsed?.inbox).toHaveLength(1);
    expect(parseMarketOverview({ ok: false })).toBeNull();
    expect(parseMarketOverview(null)).toBeNull();
  });
});

describe('createMarketApi', () => {
  it('turns failures into error results instead of throwing', async () => {
    const down = createMarketApi((async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch);
    expect(await down.overview()).toBeNull();
    expect(await down.accept(1)).toEqual({ ok: false, error: 'unreachable' });
    const refused = createMarketApi((async () =>
      new Response(JSON.stringify({ ok: false, error: 'not-found' }), { status: 404 })) as unknown as typeof fetch);
    expect(await refused.accept(1)).toEqual({ ok: false, error: 'not-found' });
  });
});

describe('MarketPanel', () => {
  afterEach(cleanup);

  it('accepts an offer, pays for it and lists neighbours offers', async () => {
    const market = fakeMarket({ offers: [offer], mine: [], inbox: [] });
    const changes: ((s: GameState) => GameState)[] = [];
    render(<MarketPanel market={market} state={stateWith(0, 10)} onChange={(update) => changes.push(update)} />);
    await waitFor(() => expect(screen.getByText('eve')).toBeTruthy());
    fireEvent.click(screen.getByText('Annehmen'));
    await waitFor(() => expect(market.accept).toHaveBeenCalledWith(7));
    await waitFor(() => expect(changes).toHaveLength(1));
    expect(changes[0]?.(stateWith(0, 10)).resources).toEqual({ wood: 0, stone: 6 });
  });

  it('does not call the server when the player cannot pay', async () => {
    const market = fakeMarket({ offers: [offer], mine: [], inbox: [] });
    render(<MarketPanel market={market} state={stateWith(0, 1)} onChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText('eve')).toBeTruthy());
    fireEvent.click(screen.getByText('Annehmen'));
    await waitFor(() => expect(screen.getByText(/fehlen dir Stein/)).toBeTruthy());
    expect(market.accept).not.toHaveBeenCalled();
  });

  it('reserves goods when posting an offer', async () => {
    const market = fakeMarket({ offers: [], mine: [], inbox: [] });
    const changes: ((s: GameState) => GameState)[] = [];
    render(<MarketPanel market={market} state={stateWith(30, 0)} onChange={(update) => changes.push(update)} />);
    await waitFor(() => expect(market.overview).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Angebot einstellen'));
    await waitFor(() =>
      expect(market.createOffer).toHaveBeenCalledWith({ giveResource: 'wood', giveAmount: 10, wantResource: 'stone', wantAmount: 5 }),
    );
    await waitFor(() => expect(changes).toHaveLength(1));
    expect(changes[0]?.(stateWith(30, 0)).resources).toEqual({ wood: 20, stone: 0 });
  });

  it('collects deliveries that fit into the storage', async () => {
    const inbox = [
      { id: 1, resource: 'wood', amount: 10, reason: 'purchase', counterpart: 'eve' },
      { id: 2, resource: 'wood', amount: 10, reason: 'purchase', counterpart: 'eve' },
    ] as const;
    const market = fakeMarket({ offers: [], mine: [], inbox: [...inbox] });
    const changes: ((s: GameState) => GameState)[] = [];
    render(<MarketPanel market={market} state={stateWith(290, 0)} onChange={(update) => changes.push(update)} />);
    // 300 is the wood limit: only one of the two deliveries (10 each) fits.
    await waitFor(() => expect(market.claim).toHaveBeenCalledWith([1]));
    await act(async () => undefined);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.(stateWith(290, 0)).resources.wood).toBe(300);
  });
});
