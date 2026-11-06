import { TRADE_MAX_AMOUNT, TRADE_RESOURCES } from '@mergeforge/domain';
import { request } from './api-client';
import { API_BASE } from './types';

export type TradeResourceId = (typeof TRADE_RESOURCES)[number];

export interface MarketOffer {
  readonly id: number;
  readonly seller: string;
  readonly giveResource: TradeResourceId;
  readonly giveAmount: number;
  readonly wantResource: TradeResourceId;
  readonly wantAmount: number;
}

export interface MarketDelivery {
  readonly id: number;
  readonly resource: TradeResourceId;
  readonly amount: number;
  readonly reason: 'sale' | 'purchase' | 'refund';
  readonly counterpart: string;
}

export interface MarketOverview {
  readonly offers: readonly MarketOffer[];
  readonly mine: readonly MarketOffer[];
  readonly inbox: readonly MarketDelivery[];
}

export type MarketResult<T extends object = object> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly error: string };

export interface MarketApi {
  overview(): Promise<MarketOverview | null>;
  createOffer(offer: Omit<MarketOffer, 'id' | 'seller'>): Promise<MarketResult>;
  accept(offerId: number): Promise<MarketResult>;
  cancel(offerId: number): Promise<MarketResult>;
  claim(ids: readonly number[]): Promise<MarketResult<{ claimed: readonly { id: number; resource: TradeResourceId; amount: number }[] }>>;
}

const isTradeResource = (value: unknown): value is TradeResourceId =>
  typeof value === 'string' && (TRADE_RESOURCES as readonly string[]).includes(value);
const isTradeAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= TRADE_MAX_AMOUNT;

function parseOffers(list: unknown): MarketOffer[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: unknown) => {
    const o = entry as Record<string, unknown> | null;
    if (
      typeof o?.id !== 'number' ||
      typeof o.seller !== 'string' ||
      !isTradeResource(o.giveResource) ||
      !isTradeResource(o.wantResource) ||
      !isTradeAmount(o.giveAmount) ||
      !isTradeAmount(o.wantAmount)
    ) {
      return [];
    }
    return [{ id: o.id, seller: o.seller, giveResource: o.giveResource, giveAmount: o.giveAmount, wantResource: o.wantResource, wantAmount: o.wantAmount }];
  });
}

/** Keeps only well-formed parts of a /market answer. */
export function parseMarketOverview(body: unknown): MarketOverview | null {
  const data = body as { ok?: unknown; offers?: unknown; mine?: unknown; inbox?: unknown } | null;
  if (data === null || data.ok !== true) return null;
  const inbox = Array.isArray(data.inbox)
    ? data.inbox.flatMap((entry: unknown) => {
        const d = entry as Record<string, unknown> | null;
        if (
          typeof d?.id !== 'number' ||
          !isTradeResource(d.resource) ||
          typeof d.amount !== 'number' ||
          !Number.isInteger(d.amount) ||
          d.amount < 1 ||
          (d.reason !== 'sale' && d.reason !== 'purchase' && d.reason !== 'refund')
        ) {
          return [];
        }
        return [{ id: d.id, resource: d.resource, amount: d.amount, reason: d.reason as MarketDelivery['reason'], counterpart: typeof d.counterpart === 'string' ? d.counterpart : '' }];
      })
    : [];
  return { offers: parseOffers(data.offers), mine: parseOffers(data.mine), inbox };
}

export function createMarketApi(fetcher: typeof fetch): MarketApi {
  const post = async (path: string, body: unknown): Promise<Record<string, unknown> & { ok: boolean }> => {
    try {
      const response = await request(fetcher, `${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as Record<string, unknown>;
      return { ...data, ok: response.ok && data.ok === true };
    } catch {
      return { ok: false, error: 'unreachable' };
    }
  };
  const failure = (data: Record<string, unknown>): { ok: false; error: string } => ({
    ok: false,
    error: typeof data.error === 'string' ? data.error : 'unreachable',
  });
  return {
    async overview() {
      try {
        const response = await request(fetcher, `${API_BASE}/market`);
        return response.ok ? parseMarketOverview(await response.json()) : null;
      } catch {
        return null;
      }
    },
    async createOffer(offer) {
      const data = await post('/market/offers', offer);
      return data.ok ? { ok: true } : failure(data);
    },
    async accept(offerId) {
      const data = await post('/market/accept', { offerId });
      return data.ok ? { ok: true } : failure(data);
    },
    async cancel(offerId) {
      const data = await post('/market/cancel', { offerId });
      return data.ok ? { ok: true } : failure(data);
    },
    async claim(ids) {
      const data = await post('/market/claim', { ids });
      if (!data.ok || !Array.isArray(data.claimed)) return failure(data);
      const claimed = data.claimed.flatMap((entry: unknown) => {
        const c = entry as Record<string, unknown> | null;
        return typeof c?.id === 'number' && isTradeResource(c.resource) && isTradeAmount(c.amount) ? [{ id: c.id, resource: c.resource, amount: c.amount }] : [];
      });
      return { ok: true, claimed };
    },
  };
}
