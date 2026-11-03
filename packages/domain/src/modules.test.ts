import { describe, expect, it } from "vitest";
import { validateModuleManifest, type ModuleValidationContext } from "./modules";

const PULSE_MS = 10 * 60 * 1_000;
const context: ModuleValidationContext = {
  pulseMs: PULSE_MS,
  reservedIds: ["lumber-camp", "quarry", "workshop"],
};

function harzsammler(): Record<string, any> {
  return {
    manifestVersion: 1,
    id: "harzsammler",
    version: "1.0.0",
    name: "Harzsammler",
    building: {
      placement: { terrain: ["forest"], requiresRoadConnection: true },
      cost: { wood: 3, stone: 1 },
      buildTimeMs: PULSE_MS,
      icon: "icon.svg",
      production: { resource: "wood", amountPerPulse: 1 },
    },
  };
}

function rejects(mutate: (manifest: Record<string, any>) => void, expectedFragment: string): void {
  const manifest = harzsammler();
  mutate(manifest);
  const result = validateModuleManifest(manifest, context);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join(" | ")).toContain(expectedFragment);
}

describe("module manifest validation", () => {
  it("accepts the Harzsammler example and returns it unchanged", () => {
    const input = harzsammler();
    const snapshot = JSON.stringify(input);
    const result = validateModuleManifest(input, context);
    expect(result).toEqual({ ok: true, manifest: input });
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("rejects non-objects", () => {
    for (const value of [null, undefined, 3, "x", [], true]) {
      expect(validateModuleManifest(value, context).ok).toBe(false);
    }
  });

  it("rejects an unknown manifest version", () => {
    rejects((m) => { m.manifestVersion = 2; }, "manifestVersion");
  });

  it("rejects bad, empty, long and reserved ids", () => {
    rejects((m) => { m.id = ""; }, "id must");
    rejects((m) => { m.id = "Harz Sammler"; }, "id must");
    rejects((m) => { m.id = "a".repeat(33); }, "id must");
    rejects((m) => { m.id = "lumber-camp"; }, "already taken");
  });

  it("rejects unknown fields at every level", () => {
    rejects((m) => { m.script = "alert(1)"; }, 'unknown field "script"');
    rejects((m) => { m.building.onBuild = "x"; }, 'unknown field "onBuild"');
    rejects((m) => { m.building.cost.gold = 1; }, 'unknown field "gold"');
    rejects((m) => { m.building.production.bonus = 1; }, 'unknown field "bonus"');
    rejects((m) => { m.building.placement.anywhere = true; }, 'unknown field "anywhere"');
  });

  it("rejects invalid or excessive costs and production", () => {
    rejects((m) => { m.building.cost.wood = -1; }, "cost.wood");
    rejects((m) => { m.building.cost.stone = 1.5; }, "cost.stone");
    rejects((m) => { m.building.cost.wood = 51; }, "cost.wood");
    rejects((m) => { m.building.cost.wood = Number.POSITIVE_INFINITY; }, "cost.wood");
    rejects((m) => { m.building.production.amountPerPulse = 0; }, "amountPerPulse");
    rejects((m) => { m.building.production.amountPerPulse = 6; }, "amountPerPulse");
    rejects((m) => { m.building.production.resource = "gold"; }, "production.resource");
  });

  it("requires build time as 1-24 whole world pulses", () => {
    rejects((m) => { m.building.buildTimeMs = PULSE_MS - 1; }, "buildTimeMs");
    rejects((m) => { m.building.buildTimeMs = PULSE_MS + 1; }, "buildTimeMs");
    rejects((m) => { m.building.buildTimeMs = PULSE_MS * 25; }, "buildTimeMs");
    rejects((m) => { m.building.buildTimeMs = "600000"; }, "buildTimeMs");
    expect(
      validateModuleManifest({ ...harzsammler(), building: { ...harzsammler().building, buildTimeMs: PULSE_MS * 24 } }, context).ok,
    ).toBe(true);
  });

  it("rejects icons that could leave the module folder or are not svg", () => {
    rejects((m) => { m.building.icon = "../icon.svg"; }, "icon");
    rejects((m) => { m.building.icon = "sub/icon.svg"; }, "icon");
    rejects((m) => { m.building.icon = "icon.png"; }, "icon");
    rejects((m) => { m.building.icon = "https://x.test/i.svg"; }, "icon");
  });

  it("rejects unknown, duplicate or empty terrain lists", () => {
    rejects((m) => { m.building.placement.terrain = []; }, "placement.terrain");
    rejects((m) => { m.building.placement.terrain = ["forest", "forest"]; }, "placement.terrain");
    rejects((m) => { m.building.placement.terrain = ["lava"]; }, "placement.terrain");
    rejects((m) => { m.building.placement.requiresRoadConnection = "yes"; }, "requiresRoadConnection");
  });

  it("reports every problem at once", () => {
    const manifest = harzsammler();
    manifest.id = "BAD";
    manifest.building.cost.wood = -5;
    manifest.building.production.amountPerPulse = 99;
    const result = validateModuleManifest(manifest, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
