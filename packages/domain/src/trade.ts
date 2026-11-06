import { storageLimits } from "./storage";
import type { GameState, ResourceStock } from "./types";

export type TradeResource = keyof ResourceStock;
export const TRADE_RESOURCES: readonly TradeResource[] = ["wood", "stone"];
/** Largest single amount in a trade offer (the server enforces the same limit). */
export const TRADE_MAX_AMOUNT = 50;

/** How much of a resource still fits into the storage (limit from the finished storehouse level). */
export function storageRoom(state: GameState, resource: TradeResource): number {
  return Math.max(0, storageLimits(state)[resource] - state.resources[resource]);
}

/** Takes goods out of the stock for a trade; rejected (state unchanged) when there is not enough. */
export function spendForTrade(
  state: GameState,
  resource: TradeResource,
  amount: number,
): { readonly ok: boolean; readonly state: GameState } {
  if (!Number.isInteger(amount) || amount < 1 || state.resources[resource] < amount) {
    return { ok: false, state };
  }
  return {
    ok: true,
    state: { ...state, resources: { ...state.resources, [resource]: state.resources[resource] - amount } },
  };
}

/** Stores delivered goods, never beyond the storage limit. */
export function receiveFromTrade(state: GameState, resource: TradeResource, amount: number): GameState {
  if (!Number.isInteger(amount) || amount < 1) return state;
  const stored = Math.min(amount, storageRoom(state, resource));
  if (stored === 0) return state;
  return { ...state, resources: { ...state.resources, [resource]: state.resources[resource] + stored } };
}
