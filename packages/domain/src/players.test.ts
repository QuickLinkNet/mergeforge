import { describe, expect, it } from "vitest";
import {
  EMPTY_PLAYER_REGISTRY,
  isValidPlayerId,
  registerPlayer,
  sectorForIndex,
  sectorSeed,
} from "./players";

const ID_A = `mf_${"a".repeat(32)}`;
const ID_B = `mf_${"b".repeat(32)}`;

function must(result: ReturnType<typeof registerPlayer>) {
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe("sectors", () => {
  it("starts at the origin and fills rings of 6k sectors without repeats", () => {
    expect(sectorForIndex(0)).toEqual({ q: 0, r: 0 });
    const keys = new Set<string>();
    for (let index = 0; index < 1 + 6 + 12 + 18; index += 1) {
      const { q, r } = sectorForIndex(index);
      keys.add(`${q},${r}`);
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
      const expected = index === 0 ? 0 : index <= 6 ? 1 : index <= 18 ? 2 : 3;
      expect(ring).toBe(expected);
    }
    expect(keys.size).toBe(37);
  });

  it("rejects invalid indices", () => {
    expect(() => sectorForIndex(-1)).toThrow(RangeError);
    expect(() => sectorForIndex(1.5)).toThrow(RangeError);
  });

  it("derives distinct seeds per sector", () => {
    expect(sectorSeed("u", { q: 0, r: 0 })).not.toBe(sectorSeed("u", { q: 1, r: 0 }));
    expect(sectorSeed("u", { q: 1, r: 0 })).toBe(sectorSeed("u", { q: 1, r: 0 }));
  });
});

describe("registerPlayer", () => {
  it("registers two players in separate sectors", () => {
    const first = must(registerPlayer(EMPTY_PLAYER_REGISTRY, 101, "alice", ID_A));
    const second = must(registerPlayer(first.registry, 202, "bob", ID_B));
    expect(first.created && second.created).toBe(true);
    expect(first.player.sector).not.toEqual(second.player.sector);
    expect(second.registry.players).toHaveLength(2);
  });

  it("returns the same player and sector on every later login", () => {
    const first = must(registerPlayer(EMPTY_PLAYER_REGISTRY, 101, "alice", ID_A));
    const again = must(registerPlayer(first.registry, 101, "alice", ID_B));
    expect(again.created).toBe(false);
    expect(again.player).toBe(first.player);
    expect(again.registry).toBe(first.registry);
  });

  it("keeps ID and sector when only the GitHub login changes", () => {
    const first = must(registerPlayer(EMPTY_PLAYER_REGISTRY, 101, "alice", ID_A));
    const renamed = must(registerPlayer(first.registry, 101, "alice-new", ID_B));
    expect(renamed.player).toEqual({ ...first.player, githubLogin: "alice-new" });
    expect(renamed.registry.players).toHaveLength(1);
  });

  it("rejects bad input without changing the registry", () => {
    expect(registerPlayer(EMPTY_PLAYER_REGISTRY, 0, "x", ID_A)).toMatchObject({ ok: false, reason: "invalid-github-user" });
    expect(registerPlayer(EMPTY_PLAYER_REGISTRY, 1.5, "x", ID_A)).toMatchObject({ ok: false, reason: "invalid-github-user" });
    expect(registerPlayer(EMPTY_PLAYER_REGISTRY, 1, " ", ID_A)).toMatchObject({ ok: false, reason: "invalid-github-user" });
    expect(registerPlayer(EMPTY_PLAYER_REGISTRY, 1, "x", "nope")).toMatchObject({ ok: false, reason: "invalid-player-id" });
    const first = must(registerPlayer(EMPTY_PLAYER_REGISTRY, 1, "x", ID_A));
    const clash = registerPlayer(first.registry, 2, "y", ID_A);
    expect(clash).toMatchObject({ ok: false, reason: "player-id-taken" });
    expect(clash.registry).toBe(first.registry);
  });

  it("validates the ID format", () => {
    expect(isValidPlayerId(ID_A)).toBe(true);
    expect(isValidPlayerId("mf_ABC")).toBe(false);
    expect(isValidPlayerId(5)).toBe(false);
  });
});
