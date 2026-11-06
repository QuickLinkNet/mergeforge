import { describe, expect, it } from "vitest";
import {
  MAX_STONE_STORAGE,
  MAX_WOOD_STORAGE,
  receiveFromTrade,
  spendForTrade,
  storageRoom,
  type GameState,
} from "./index";

// The trade helpers only touch the resource stock; the storage limit comes from the
// buildings (no storehouse = the base limits).
function stateWith(wood: number, stone: number): GameState {
  return { resources: { wood, stone }, buildings: [] } as unknown as GameState;
}

describe("trade helpers", () => {
  it("spends goods only when enough is in stock", () => {
    const state = stateWith(10, 3);
    const spent = spendForTrade(state, "wood", 4);
    expect(spent.ok).toBe(true);
    expect(spent.state.resources).toEqual({ wood: 6, stone: 3 });
    const rejected = spendForTrade(state, "stone", 4);
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toBe(state);
    expect(spendForTrade(state, "wood", 0).ok).toBe(false);
    expect(spendForTrade(state, "wood", 1.5).ok).toBe(false);
  });

  it("stores deliveries only up to the storage limit", () => {
    expect(storageRoom(stateWith(MAX_WOOD_STORAGE - 5, 0), "wood")).toBe(5);
    expect(storageRoom(stateWith(0, MAX_STONE_STORAGE), "stone")).toBe(0);
    const received = receiveFromTrade(stateWith(MAX_WOOD_STORAGE - 5, 2), "wood", 20);
    expect(received.resources).toEqual({ wood: MAX_WOOD_STORAGE, stone: 2 });
    const full = stateWith(0, MAX_STONE_STORAGE);
    expect(receiveFromTrade(full, "stone", 3)).toBe(full);
    expect(receiveFromTrade(full, "wood", -2)).toBe(full);
  });
});
