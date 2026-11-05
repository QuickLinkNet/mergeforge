import { describe, expect, it } from "vitest";
import {
  WORLD_PULSE_MS,
  buildCatalog,
  buildPulses,
  catalogDepths,
  coreCatalog,
  formatBuildTime,
  moduleCatalogEntry,
  renderTechTreeSvg,
  type CatalogEntry,
  type ModuleManifest,
} from "./index";

describe("build catalog", () => {
  it("has unique ids and only known prerequisites", () => {
    const entries = coreCatalog();
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(() => catalogDepths(entries)).not.toThrow();
  });

  it("orders prerequisites before dependants", () => {
    const entries = coreCatalog();
    const index = new Map(entries.map((entry, position) => [entry.id, position]));
    for (const entry of entries) {
      for (const required of entry.requires) {
        expect(index.get(required)).toBeLessThan(index.get(entry.id) as number);
      }
    }
  });

  it("builds in whole world pulses", () => {
    for (const entry of coreCatalog()) {
      expect(entry.buildMs % WORLD_PULSE_MS).toBe(0);
    }
  });

  it("states the numbers the game rules use", () => {
    const byId = new Map(coreCatalog().map((entry) => [entry.id, entry]));
    expect(byId.get("road")?.cost).toEqual({ wood: 1, stone: 0 });
    expect(byId.get("lumber-camp")).toMatchObject({ cost: { wood: 4, stone: 1 }, buildMs: WORLD_PULSE_MS });
    expect(byId.get("quarry")).toMatchObject({ cost: { wood: 3, stone: 1 }, buildMs: WORLD_PULSE_MS });
    expect(byId.get("pathfinder")).toMatchObject({ cost: { wood: 2, stone: 2 }, buildMs: WORLD_PULSE_MS });
    expect(byId.get("survey-tent")).toMatchObject({ cost: { wood: 3, stone: 1 }, buildMs: WORLD_PULSE_MS });
    expect(byId.get("workshop")).toMatchObject({ cost: { wood: 6, stone: 4 }, buildMs: 2 * WORLD_PULSE_MS });
    expect(byId.get("relay-repair")).toMatchObject({ cost: { wood: 5, stone: 6 }, buildMs: 3 * WORLD_PULSE_MS });
  });

  it("adds modules from their manifest", () => {
    const manifest: ModuleManifest = {
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
      },
    };
    const entry = moduleCatalogEntry(manifest);
    expect(entry).toMatchObject({ id: "module:harzsammler", requires: ["road"], cost: { wood: 3, stone: 1 }, source: "harzsammler" });
    expect(buildCatalog([manifest]).at(-1)).toEqual(entry);
  });

  it("formats times for players", () => {
    expect(formatBuildTime(0)).toBe("Sofort");
    expect(formatBuildTime(WORLD_PULSE_MS)).toBe("10 Min");
    expect(formatBuildTime(6 * WORLD_PULSE_MS)).toBe("1 Std");
    expect(formatBuildTime(9 * WORLD_PULSE_MS)).toBe("1 Std 30 Min");
    expect(buildPulses(3 * WORLD_PULSE_MS)).toBe(3);
  });

  it("rejects prerequisite cycles", () => {
    const entry = (id: string, requires: string[]): CatalogEntry => ({
      id, name: id, category: "module", placement: "none", cost: { wood: 0, stone: 0 }, buildMs: 0,
      usesBuildSlot: false, requires, condition: "", effect: "", source: "core",
    });
    expect(() => catalogDepths([entry("a", ["b"]), entry("b", ["a"])])).toThrow(/cycle/);
  });
});

describe("tech tree picture", () => {
  it("is deterministic and shows every entry", () => {
    const catalog = coreCatalog();
    const svg = renderTechTreeSvg(catalog);
    expect(renderTechTreeSvg(coreCatalog())).toBe(svg);
    expect(svg.startsWith("<svg")).toBe(true);
    for (const entry of catalog) expect(svg).toContain(entry.name);
  });
});
