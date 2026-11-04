import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TRADE_MAX_AMOUNT,
  TRADE_RESOURCES,
  receiveFromTrade,
  spendForTrade,
  storageRoom,
  type GameState,
} from '@mergeforge/domain';
import type { MarketApi, MarketDelivery, MarketOverview, TradeResourceId } from './online';

const REFRESH_MS = 20_000;

export const resourceLabel: Readonly<Record<TradeResourceId, string>> = { wood: 'Holz', stone: 'Stein' };

const errorCopy: Readonly<Record<string, string>> = {
  'too-many-offers': 'Du hast schon drei offene Angebote.',
  'not-found': 'Das Angebot gibt es nicht mehr.',
  'invalid-offer': 'Dieses Angebot ist ungültig.',
  unreachable: 'Der Handelsposten ist gerade nicht erreichbar.',
};

function describeDelivery(delivery: MarketDelivery): string {
  const goods = `${delivery.amount} ${resourceLabel[delivery.resource]}`;
  if (delivery.reason === 'refund') return `${goods} zurück im Lager (Angebot zurückgezogen)`;
  if (delivery.reason === 'sale') return `${delivery.counterpart || 'Ein Nachbar'} hat dein Angebot angenommen: +${goods}`;
  return `Handel mit ${delivery.counterpart || 'einem Nachbarn'}: +${goods}`;
}

interface MarketPanelProps {
  readonly market: MarketApi;
  readonly state: GameState;
  /** Applies a change to the game state (so it is saved like any other action). */
  readonly onChange: (update: (state: GameState) => GameState) => void;
}

/** Trade offers with the neighbours (D-021). */
export function MarketPanel({ market, state, onChange }: MarketPanelProps) {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [giveResource, setGiveResource] = useState<TradeResourceId>('wood');
  const [giveAmount, setGiveAmount] = useState(10);
  const [wantResource, setWantResource] = useState<TradeResourceId>('stone');
  const [wantAmount, setWantAmount] = useState(5);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    const next = await market.overview();
    if (next === null) return;
    // Deliveries are taken over as far as they fit into the storage.
    const room: Record<TradeResourceId, number> = {
      wood: storageRoom(stateRef.current, 'wood'),
      stone: storageRoom(stateRef.current, 'stone'),
    };
    const fitting: MarketDelivery[] = [];
    for (const delivery of next.inbox) {
      if (room[delivery.resource] >= delivery.amount) {
        room[delivery.resource] -= delivery.amount;
        fitting.push(delivery);
      }
    }
    if (fitting.length === 0) {
      setOverview(next);
      return;
    }
    const claimed = await market.claim(fitting.map((delivery) => delivery.id));
    if (!claimed.ok) {
      setOverview(next);
      return;
    }
    const taken = new Set(claimed.claimed.map((item) => item.id));
    onChange((current) => claimed.claimed.reduce((acc, item) => receiveFromTrade(acc, item.resource, item.amount), current));
    setNotice(fitting.filter((delivery) => taken.has(delivery.id)).map(describeDelivery).join(' · '));
    setOverview({ ...next, inbox: next.inbox.filter((delivery) => !taken.has(delivery.id)) });
  }, [market, onChange]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const run = async (action: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    try {
      setNotice(await action());
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const failure = (error: string): string => errorCopy[error] ?? 'Das hat nicht geklappt.';

  const postOffer = () =>
    run(async () => {
      if (spendForTrade(stateRef.current, giveResource, giveAmount).ok === false) {
        return `Dafür fehlen dir ${resourceLabel[giveResource]}.`;
      }
      const result = await market.createOffer({ giveResource, giveAmount, wantResource, wantAmount });
      if (!result.ok) return failure(result.error);
      onChange((current) => spendForTrade(current, giveResource, giveAmount).state);
      return `Angebot eingestellt: ${giveAmount} ${resourceLabel[giveResource]} gegen ${wantAmount} ${resourceLabel[wantResource]}.`;
    });

  const acceptOffer = (offerId: number) =>
    run(async () => {
      const offer = overview?.offers.find((candidate) => candidate.id === offerId);
      if (offer === undefined) return failure('not-found');
      if (spendForTrade(stateRef.current, offer.wantResource, offer.wantAmount).ok === false) {
        return `Dafür fehlen dir ${resourceLabel[offer.wantResource]}.`;
      }
      if (storageRoom(stateRef.current, offer.giveResource) < offer.giveAmount) {
        return `Dein ${resourceLabel[offer.giveResource]}-Lager hat dafür nicht genug Platz.`;
      }
      const result = await market.accept(offerId);
      if (!result.ok) return failure(result.error);
      onChange((current) => spendForTrade(current, offer.wantResource, offer.wantAmount).state);
      return `Angenommen: ${offer.giveAmount} ${resourceLabel[offer.giveResource]} sind unterwegs.`;
    });

  const withdrawOffer = (offerId: number) =>
    run(async () => {
      const result = await market.cancel(offerId);
      return result.ok ? 'Angebot zurückgezogen.' : failure(result.error);
    });

  const amountInput = (value: number, set: (next: number) => void, label: string) => (
    <input
      aria-label={label}
      type="number"
      min={1}
      max={TRADE_MAX_AMOUNT}
      value={value}
      onChange={(event) => set(Math.max(1, Math.min(TRADE_MAX_AMOUNT, Math.floor(Number(event.target.value)) || 1)))}
    />
  );
  const resourceSelect = (value: TradeResourceId, set: (next: TradeResourceId) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(event) => set(event.target.value as TradeResourceId)}>
      {TRADE_RESOURCES.map((id) => (
        <option key={id} value={id}>{resourceLabel[id]}</option>
      ))}
    </select>
  );

  return (
    <section className="build-card market-card" aria-labelledby="market-title">
      <div className="build-card-heading">
        <span className="road-symbol relay-symbol" aria-hidden="true">⇄</span>
        <span><small>Mit deinen Funkkontakten</small><h2 id="market-title">Handelsposten</h2></span>
      </div>

      {notice !== null && <p className="market-notice" role="status">{notice}</p>}

      <h3 className="market-subtitle">Angebote der Nachbarn</h3>
      {overview === null || overview.offers.length === 0 ? (
        <p className="build-explanation">Gerade bietet kein Nachbar etwas an.</p>
      ) : (
        <ul className="market-list">
          {overview.offers.map((offer) => (
            <li key={offer.id} className="market-item">
              <span>
                <strong>{offer.seller}</strong>
                <em>{offer.giveAmount} {resourceLabel[offer.giveResource]} gegen {offer.wantAmount} {resourceLabel[offer.wantResource]}</em>
              </span>
              <button type="button" disabled={busy} onClick={() => void acceptOffer(offer.id)}>Annehmen</button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="market-subtitle">Deine Angebote</h3>
      {overview !== null && overview.mine.length > 0 && (
        <ul className="market-list">
          {overview.mine.map((offer) => (
            <li key={offer.id} className="market-item">
              <span><em>{offer.giveAmount} {resourceLabel[offer.giveResource]} gegen {offer.wantAmount} {resourceLabel[offer.wantResource]}</em></span>
              <button type="button" disabled={busy} onClick={() => void withdrawOffer(offer.id)}>Zurückziehen</button>
            </li>
          ))}
        </ul>
      )}
      <div className="market-form">
        <span>Ich gebe</span>
        {amountInput(giveAmount, setGiveAmount, 'Menge, die du gibst')}
        {resourceSelect(giveResource, setGiveResource, 'Ressource, die du gibst')}
        <span>für</span>
        {amountInput(wantAmount, setWantAmount, 'Menge, die du willst')}
        {resourceSelect(wantResource, setWantResource, 'Ressource, die du willst')}
      </div>
      <div className="build-actions">
        <button
          className="primary-action"
          type="button"
          disabled={busy || giveResource === wantResource}
          onClick={() => void postOffer()}
        >
          Angebot einstellen
        </button>
      </div>
      <p className="build-explanation">
        Die angebotene Ware wird sofort aus deinem Lager genommen und kommt zurück, wenn du das Angebot zurückziehst. Lieferungen erscheinen automatisch, sobald im Lager Platz ist.
      </p>
    </section>
  );
}
