import { describe, expect, it } from "vitest";

import {
  advanceTime,
  createFarSignals,
  createInitialGameState,
  createSimulatedNeighbors,
  describeDistanceBand,
  distanceBandFor,
  hasCompletedChapter,
  hasPrologueEvent,
  hasRelayCapability,
  scanFarSignals,
  NEIGHBOR_MAX_DISTANCE,
  NEIGHBOR_MIN_DISTANCE,
  SIGNAL_BEARINGS,
  SIGNAL_DISTANCE_BANDS,
  rotateSignalwerkRune,
  startWorkshop,
  startRelayRepair,
  WORKSHOP_BUILD_MS,
  WORKSHOP_STONE_COST,
  WORKSHOP_WOOD_COST,
  RELAY_REPAIR_MS,
  RELAY_REPAIR_STONE_COST,
  RELAY_REPAIR_WOOD_COST,
  WORLD_PULSE_MS,
  type GameState,
} from "./index";
import {
  createUnlockedSignalwerkState,
  solveSignalwerk,
  createWorld,
} from "./test-fixtures";

describe("Signalwerk domain integration", () => {
  it("keeps rotation locked until both chapter 5 and relay discovery", () => {
    const initial = createInitialGameState(createWorld());
    expect(rotateSignalwerkRune(initial, 0)).toEqual({
      ok: false,
      reason: "locked",
      state: initial,
    });

    const chapterOnly: GameState = {
      ...initial,
      prologue: { ...initial.prologue, completedChapterIds: [3, 4, 5] },
    };
    expect(rotateSignalwerkRune(chapterOnly, 0)).toMatchObject({
      ok: false,
      reason: "locked",
    });

    const eventOnly: GameState = {
      ...initial,
      prologue: { ...initial.prologue, eventIds: ["relay_discovered"] },
    };
    expect(rotateSignalwerkRune(eventOnly, 0)).toMatchObject({
      ok: false,
      reason: "locked",
    });
  });

  it("rotates exactly one of 25 runes by 90 degrees without time or resource cost", () => {
    const unlocked = createUnlockedSignalwerkState();
    const beforeRotations = unlocked.signalwerk.rotations;
    const result = rotateSignalwerkRune(unlocked, 0);
    if (!result.ok) throw new Error("Expected Signalwerk rotation.");

    expect(result.state.signalwerk.rotations).toHaveLength(25);
    expect(result.state.signalwerk.rotations[0]).toBe(
      ((beforeRotations[0] ?? 0) + 1) % 4,
    );
    expect(result.state.signalwerk.rotations.slice(1)).toEqual(
      beforeRotations.slice(1),
    );
    expect(result.state.resources).toBe(unlocked.resources);
    expect(result.state.lastAdvancedAtMs).toBe(unlocked.lastAdvancedAtMs);

    for (const index of [-1, 25, 1.5, Number.NaN]) {
      expect(rotateSignalwerkRune(unlocked, index)).toEqual({
        ok: false,
        reason: "tile-not-found",
        state: unlocked,
      });
    }
  });

  it("awards the unique resonance core and solved event atomically on first solution", () => {
    const unlocked = createUnlockedSignalwerkState();
    const solved = solveSignalwerk(unlocked);

    expect(solved.signalwerk.solved).toBe(true);
    expect(solved.inventory).toEqual({ resonanceCore: 1 });
    expect(solved.prologue.eventIds).toEqual([
      "relay_discovered",
      "signalwerk_solved",
    ]);
    expect(solved.resources).toBe(unlocked.resources);
    expect(solved.lastAdvancedAtMs).toBe(unlocked.lastAdvancedAtMs);
  });

  it("rejects solved puzzles after JSON reload without duplicating event or core", () => {
    const solved = solveSignalwerk(createUnlockedSignalwerkState());
    const reloaded = JSON.parse(JSON.stringify(solved)) as GameState;
    const repeated = rotateSignalwerkRune(reloaded, 0);

    expect(repeated).toEqual({
      ok: false,
      reason: "already-solved",
      state: reloaded,
    });
    expect(
      repeated.state.prologue.eventIds.filter(
        (eventId) => eventId === "signalwerk_solved",
      ),
    ).toHaveLength(1);
    expect(repeated.state.inventory.resonanceCore).toBe(1);
  });
});

describe("workshop and relay repair", () => {
  it("locks the workshop until the Signalwerk is solved", () => {
    const state = createUnlockedSignalwerkState();
    expect(startWorkshop(state, 0)).toMatchObject({ ok: false, reason: "locked" });
  });

  it("builds the village workshop for the confirmed cost and duration", () => {
    const solved = { ...solveSignalwerk(createUnlockedSignalwerkState()), resources: { wood: 30, stone: 30 } };
    const started = startWorkshop(solved, 0);
    if (!started.ok) throw new Error(`Unexpected workshop rejection: ${started.reason}`);

    expect(started.state.resources).toEqual({
      wood: 30 - WORKSHOP_WOOD_COST,
      stone: 30 - WORKSHOP_STONE_COST,
    });
    expect(started.state.buildings.at(-1)).toMatchObject({
      type: "workshop",
      status: "constructing",
      tileKey: "0,0",
      completesAtMs: WORKSHOP_BUILD_MS,
    });
    expect(startWorkshop(started.state, 0)).toMatchObject({ ok: false, reason: "already-built" });

    const active = advanceTime(started.state, WORKSHOP_BUILD_MS);
    expect(active.buildings.at(-1)).toMatchObject({ type: "workshop", status: "active" });
  });

  it("installs the unique core and completes chapter 6 exactly once", () => {
    const solved = { ...solveSignalwerk(createUnlockedSignalwerkState()), resources: { wood: 30, stone: 30 } };
    const workshopOrder = startWorkshop(solved, 0);
    if (!workshopOrder.ok) throw new Error("Expected workshop order.");
    expect(startRelayRepair(workshopOrder.state, 0)).toMatchObject({
      ok: false,
      reason: "workshop-required",
    });

    const workshopActive = advanceTime(workshopOrder.state, WORKSHOP_BUILD_MS);
    const repair = startRelayRepair(workshopActive, WORKSHOP_BUILD_MS);
    if (!repair.ok) throw new Error(`Unexpected repair rejection: ${repair.reason}`);

    expect(repair.state.resources).toEqual({
      wood: 30 - WORKSHOP_WOOD_COST - RELAY_REPAIR_WOOD_COST,
      stone: 30 - WORKSHOP_STONE_COST - RELAY_REPAIR_STONE_COST,
    });
    expect(repair.state.inventory.resonanceCore).toBe(0);
    expect(repair.state.relay).toMatchObject({ status: "repairing", coreInstalled: true });
    expect(startRelayRepair(repair.state, WORKSHOP_BUILD_MS)).toMatchObject({
      ok: false,
      reason: "already-started",
    });

    const completedAt = WORKSHOP_BUILD_MS + RELAY_REPAIR_MS;
    const completed = advanceTime(repair.state, completedAt);
    expect(completed.relay).toMatchObject({ status: "active", coreInstalled: true });
    expect(completed.prologue.eventIds).toEqual([
      "relay_discovered",
      "signalwerk_solved",
      "relay_repaired",
    ]);
    expect(completed.prologue.completedChapterIds).toEqual([3, 4, 5, 6]);

    const reloaded = JSON.parse(JSON.stringify(completed)) as GameState;
    const later = advanceTime(reloaded, completedAt + WORLD_PULSE_MS);
    expect(later.prologue.eventIds.filter((event) => event === "relay_repaired")).toHaveLength(1);
    expect(later.prologue.completedChapterIds.filter((chapter) => chapter === 6)).toHaveLength(1);
  });
});

describe("chapter 7 — the first signal", () => {
  function activeRelayState(): { state: GameState; completedAt: number } {
    const solved = { ...solveSignalwerk(createUnlockedSignalwerkState()), resources: { wood: 30, stone: 30 } };
    const workshopOrder = startWorkshop(solved, 0);
    if (!workshopOrder.ok) throw new Error("Expected workshop order.");
    const workshopActive = advanceTime(workshopOrder.state, WORKSHOP_BUILD_MS);
    const repair = startRelayRepair(workshopActive, WORKSHOP_BUILD_MS);
    if (!repair.ok) throw new Error("Expected repair order.");
    return { state: repair.state, completedAt: WORKSHOP_BUILD_MS + RELAY_REPAIR_MS };
  }

  it("creates identical signals for the same seed and generator version", () => {
    expect(createFarSignals("seed-a", "gen-1")).toEqual(createFarSignals("seed-a", "gen-1"));
    expect(createSimulatedNeighbors("seed-a", "gen-1")).toEqual(
      createSimulatedNeighbors("seed-a", "gen-1"),
    );
  });

  it("varies with seed and generator version", () => {
    const fingerprints = new Set<string>();
    for (let index = 0; index < 40; index += 1) {
      fingerprints.add(JSON.stringify(createFarSignals(`seed-${index}`, "gen-1")));
    }
    expect(fingerprints.size).toBeGreaterThan(10);
    expect(JSON.stringify(createFarSignals("seed-a", "gen-1"))).not.toBe(
      JSON.stringify(createFarSignals("seed-a", "gen-2")),
    );
  });

  it("respects the neighbour distance contract and keeps neighbours apart", () => {
    for (let index = 0; index < 300; index += 1) {
      const neighbors = createSimulatedNeighbors(`seed-${index}`, "gen-1");
      expect(neighbors).toHaveLength(2);
      for (const neighbor of neighbors) {
        expect(neighbor.distanceFields).toBeGreaterThanOrEqual(NEIGHBOR_MIN_DISTANCE);
        expect(neighbor.distanceFields).toBeLessThanOrEqual(NEIGHBOR_MAX_DISTANCE);
      }
      const [first, second] = neighbors;
      expect(first?.bearingIndex).not.toBe(second?.bearingIndex);
    }
  });

  it("exposes only a compass sector and a coarse distance band", () => {
    for (let index = 0; index < 50; index += 1) {
      for (const signal of createFarSignals(`seed-${index}`, "gen-1")) {
        expect(Object.keys(signal).sort()).toEqual(["bearing", "distanceBand", "id"]);
        expect(SIGNAL_BEARINGS).toContain(signal.bearing);
        expect(SIGNAL_DISTANCE_BANDS.map((band) => band.id)).toContain(signal.distanceBand);
      }
    }
    const [first, second] = createSimulatedNeighbors("seed-0", "gen-1");
    const band = createFarSignals("seed-0", "gen-1")[0];
    const expected = SIGNAL_DISTANCE_BANDS.find(
      (candidate) =>
        (first?.distanceFields ?? 0) >= candidate.minFields &&
        (first?.distanceFields ?? 0) <= candidate.maxFields,
    );
    expect(band?.distanceBand).toBe(expected?.id);
    expect(second).toBeDefined();
  });

  it("rejects distances outside the contract range when binning", () => {
    expect(() => distanceBandFor(17)).toThrow(RangeError);
    expect(() => distanceBandFor(25)).toThrow(RangeError);
    expect(describeDistanceBand("near")).toBe("18–20 Felder");
  });

  it("stays locked before the relay is active and has no signals", () => {
    const { state, completedAt } = activeRelayState();
    expect(state.signals).toEqual([]);
    const midway = advanceTime(state, completedAt - 1);
    expect(hasCompletedChapter(midway, 7)).toBe(false);
    expect(midway.signals).toEqual([]);
    expect(hasRelayCapability(midway, "signal_network_active")).toBe(false);
    expect(scanFarSignals(midway, completedAt - 1)).toMatchObject({ ok: false, reason: "locked" });
  });

  it("does not complete chapter 7 by itself, however much time passes", () => {
    const { state, completedAt } = activeRelayState();
    const later = advanceTime(state, completedAt + 50 * WORLD_PULSE_MS);
    expect(hasCompletedChapter(later, 6)).toBe(true);
    expect(hasCompletedChapter(later, 7)).toBe(false);
    expect(later.signals).toEqual([]);
    expect(hasRelayCapability(later, "signal_network_active")).toBe(false);
    expect(hasPrologueEvent(later, "first_signals_received")).toBe(false);
  });

  it("completes chapter 7 through the scan action exactly once with capability and event", () => {
    const { state, completedAt } = activeRelayState();
    const ready = advanceTime(state, completedAt);
    const scan = scanFarSignals(ready, completedAt);
    if (!scan.ok) throw new Error(`Unexpected scan rejection: ${scan.reason}`);
    const completed = scan.state;

    expect(hasCompletedChapter(completed, 7)).toBe(true);
    expect(completed.prologue.completedChapterIds).toEqual([3, 4, 5, 6, 7]);
    expect(hasPrologueEvent(completed, "first_signals_received")).toBe(true);
    expect(hasRelayCapability(completed, "signal_network_active")).toBe(true);
    expect(completed.signals).toEqual(
      createFarSignals(completed.world.seed, completed.world.generatorVersion),
    );

    expect(scanFarSignals(completed, completedAt)).toMatchObject({ ok: false, reason: "already-scanned" });
    const reloaded = JSON.parse(JSON.stringify(completed)) as GameState;
    const later = advanceTime(reloaded, completedAt + 5 * WORLD_PULSE_MS);
    expect(later.prologue.completedChapterIds.filter((chapter) => chapter === 7)).toHaveLength(1);
    expect(later.prologue.eventIds.filter((event) => event === "first_signals_received")).toHaveLength(1);
    expect(later.relay).toMatchObject({ capabilities: ["signal_network_active"] });
    expect(later.signals).toEqual(completed.signals);
    expect(scanFarSignals(later, completedAt + 5 * WORLD_PULSE_MS)).toMatchObject({
      ok: false,
      reason: "already-scanned",
    });
  });

  it("does not change costs, timers or resources when scanning", () => {
    const { state, completedAt } = activeRelayState();
    const ready = advanceTime(state, completedAt);
    const scan = scanFarSignals(ready, completedAt);
    if (!scan.ok) throw new Error("Expected scan.");
    expect(scan.state.resources).toEqual(ready.resources);
    expect(scan.state.buildings).toEqual(ready.buildings);
    expect(scan.state.lastAdvancedAtMs).toBe(ready.lastAdvancedAtMs);
  });
});
