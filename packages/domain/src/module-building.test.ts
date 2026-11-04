import { describe, expect, it } from "vitest";
import {
  WORLD_PULSE_MS,
  advanceTime,
  buildRoad,
  createInitialGameState,
  hexKey,
  startLumberCamp,
  startModuleBuilding,
  type GameState,
  type HexTile,
  type ModuleManifest,
  type Terrain,
  type WorldSnapshot,
} from "./index";

function harzsammler(overrides: Partial<ModuleManifest["building"]> = {}): ModuleManifest {
  return {
    manifestVersion: 1,
    id: "harzsammler",
    version: "1.0.0",
    name: "Harzsammler",
    building: {
      placement: { terrain: ["forest"], requiresRoadConnection: true },
      cost: { wood: 3, stone: 1 },
      buildTimeMs: WORLD_PULSE_MS,
      icon: "icon.svg",
      production: { resource: "wood", amountPerPulse: 1 },
      ...overrides,
    },
  };
}

function createWorld(forestTileKeys: readonly string[]): WorldSnapshot {
  const overrides = new Map<string, Terrain>([["0,1", "water"]]);
  for (const key of forestTileKeys) overrides.set(key, "forest");
  const tiles: HexTile[] = [];
  const radius = 2;
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r += 1) {
      tiles.push({ coord: { q, r }, terrain: overrides.get(hexKey({ q, r })) ?? "meadow", elevation: 1 });
    }
  }
  return {
    seed: "module-building-test",
    generatorVersion: "test-v1",
    radius,
    tiles,
    village: { id: "village-0", name: "Testdorf", coord: { q: 0, r: 0 } },
    visibleTileKeys: ["0,0", "1,0", "1,-1", "0,-1", "-1,0", "-1,1", "0,1"],
    resourceSites: [],
    relaySite: { id: "relay:test", tileKey: "-2,2" },
    surfaceFinds: [],
  };
}

/** Roads at 1,0 (meadow) and 2,0 (forest); plenty of resources. */
function readyState(): GameState {
  const initial = createInitialGameState(createWorld(["2,0"]));
  const first = buildRoad(initial, { q: 1, r: 0 });
  if (!first.ok) throw new Error("Expected first road.");
  const second = buildRoad(first.state, { q: 2, r: 0 });
  if (!second.ok) throw new Error("Expected second road.");
  return { ...second.state, resources: { wood: 20, stone: 10 } };
}

describe("module building", () => {
  it("starts construction from the manifest alone and reserves its costs", () => {
    const result = startModuleBuilding(readyState(), harzsammler(), { q: 2, r: 0 }, 1_000);
    if (!result.ok) throw new Error(`Unexpected rejection: ${result.reason}`);

    expect(result.state.resources).toEqual({ wood: 17, stone: 9 });
    expect(result.state.buildings).toEqual([
      {
        id: "module:harzsammler:2,0",
        type: "module",
        moduleId: "harzsammler",
        moduleVersion: "1.0.0",
        tileKey: "2,0",
        status: "constructing",
        startedAtMs: 1_000,
        completesAtMs: 1_000 + WORLD_PULSE_MS,
        lastProductionAtMs: 1_000,
        production: { resource: "wood", amountPerPulse: 1 },
      },
    ]);
    expect(result.state.modules).toEqual([{ id: "harzsammler", version: "1.0.0" }]);
  });

  it("produces from the frozen rule per pulse and catches up offline", () => {
    const started = startModuleBuilding(readyState(), harzsammler(), { q: 2, r: 0 }, 0);
    if (!started.ok) throw new Error("Expected construction.");
    const woodBefore = started.state.resources.wood;

    const firstPulse = advanceTime(started.state, WORLD_PULSE_MS);
    expect(firstPulse.buildings[0]).toMatchObject({ status: "active" });
    expect(firstPulse.resources.wood).toBe(woodBefore + 1);

    const later = advanceTime(started.state, 5 * WORLD_PULSE_MS);
    expect(later.resources.wood).toBe(woodBefore + 5);
    expect(advanceTime(later, 5 * WORLD_PULSE_MS)).toBe(later);
  });

  it("supports a stone-producing module without any special case", () => {
    const manifest = harzsammler({ production: { resource: "stone", amountPerPulse: 2 } });
    const started = startModuleBuilding(readyState(), { ...manifest, id: "steinsammler" }, { q: 2, r: 0 }, 0);
    if (!started.ok) throw new Error("Expected construction.");
    const stoneBefore = started.state.resources.stone;
    expect(advanceTime(started.state, 3 * WORLD_PULSE_MS).resources.stone).toBe(stoneBefore + 6);
  });

  it("honours the manifest's build time and cost", () => {
    const manifest = harzsammler({ cost: { wood: 5, stone: 0 }, buildTimeMs: 3 * WORLD_PULSE_MS });
    const started = startModuleBuilding(readyState(), manifest, { q: 2, r: 0 }, 0);
    if (!started.ok) throw new Error("Expected construction.");
    expect(started.state.resources).toEqual({ wood: 15, stone: 10 });
    expect(started.state.buildings[0]).toMatchObject({ completesAtMs: 3 * WORLD_PULSE_MS });
    expect(advanceTime(started.state, 2 * WORLD_PULSE_MS).buildings[0]).toMatchObject({ status: "constructing" });
    expect(advanceTime(started.state, 3 * WORLD_PULSE_MS).buildings[0]).toMatchObject({ status: "active" });
  });

  it("rejects with explicit reasons and leaves the settled state unchanged", () => {
    const state = readyState();
    const reasons = (target: { q: number; r: number }, from: GameState = state, manifest = harzsammler()) => {
      const result = startModuleBuilding(from, manifest, target, 0);
      return result.ok ? "ok" : result.reason;
    };

    expect(reasons({ q: 9, r: 9 })).toBe("tile-not-found");
    expect(reasons({ q: 1, r: 0 })).toBe("terrain-not-allowed");
    expect(reasons({ q: 2, r: 0 }, { ...state, visibleTileKeys: ["0,0"] })).toBe("not-visible");
    expect(reasons({ q: 2, r: 0 }, { ...state, roadTileKeys: ["1,0"] })).toBe("road-required");
    expect(reasons({ q: 2, r: 0 }, { ...state, resources: { wood: 2, stone: 9 } })).toBe("insufficient-resources");
    expect(reasons({ q: 2, r: 0 }, { ...state, resources: { wood: 9, stone: 0 } })).toBe("insufficient-resources");
    expect(reasons({ q: 2, r: 0 }, { ...state, modules: [{ id: "harzsammler", version: "0.9.0" }] })).toBe("module-version-conflict");

    const rejected = startModuleBuilding(state, harzsammler(), { q: 1, r: 0 }, 0);
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toEqual(state);
  });

  it("does not need a road when the manifest says so", () => {
    const manifest = harzsammler({ placement: { terrain: ["forest"], requiresRoadConnection: false } });
    const noRoad = { ...readyState(), roadTileKeys: [] };
    expect(startModuleBuilding(noRoad, manifest, { q: 2, r: 0 }, 0).ok).toBe(true);
  });

  it("shares the single build slot and the one-building-per-tile rule", () => {
    const world = createWorld(["2,0", "1,1"]);
    let state = createInitialGameState(world);
    for (const target of [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 1, r: 1 }]) {
      const road = buildRoad(state, target);
      if (!road.ok) throw new Error(`Expected road at ${hexKey(target)}.`);
      state = road.state;
    }
    state = { ...state, resources: { wood: 30, stone: 10 } };
    const first = startModuleBuilding(state, harzsammler(), { q: 2, r: 0 }, 0);
    if (!first.ok) throw new Error("Expected construction.");
    expect(startModuleBuilding(first.state, harzsammler(), { q: 1, r: 1 }, 0)).toMatchObject({ ok: false, reason: "build-slot-occupied" });
    expect(startLumberCamp(first.state, { q: 1, r: 1 }, 0)).toMatchObject({ ok: false, reason: "build-slot-occupied" });

    const active = advanceTime(first.state, WORLD_PULSE_MS);
    expect(startModuleBuilding(active, harzsammler(), { q: 2, r: 0 }, WORLD_PULSE_MS)).toMatchObject({ ok: false, reason: "already-built" });
  });

  it("references each module once even with several buildings", () => {
    const world = createWorld(["2,0", "1,1"]);
    let state = createInitialGameState(world);
    for (const target of [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 1, r: 1 }]) {
      const road = buildRoad(state, target);
      if (!road.ok) throw new Error(`Expected road at ${hexKey(target)}.`);
      state = road.state;
    }
    state = { ...state, resources: { wood: 30, stone: 10 } };

    const first = startModuleBuilding(state, harzsammler(), { q: 2, r: 0 }, 0);
    if (!first.ok) throw new Error("Expected first building.");
    const done = advanceTime(first.state, WORLD_PULSE_MS);
    const second = startModuleBuilding(done, harzsammler(), { q: 1, r: 1 }, WORLD_PULSE_MS);
    if (!second.ok) throw new Error(`Unexpected rejection: ${second.reason}`);
    expect(second.state.buildings).toHaveLength(2);
    expect(second.state.modules).toEqual([{ id: "harzsammler", version: "1.0.0" }]);
  });
});
