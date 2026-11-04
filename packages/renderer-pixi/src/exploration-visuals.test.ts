import { describe, expect, it } from "vitest";

import { filterExplorationVisuals } from "./exploration-visuals.js";

describe("exploration renderer overlays", () => {
  it("renders the wayfinder only on a visible world tile", () => {
    const wayfinder = { tileKey: "1,0", state: "active" as const };
    expect(filterExplorationVisuals(wayfinder, null, ["0,0"], ["0,0", "1,0"]).wayfinder).toBeNull();
    expect(filterExplorationVisuals(wayfinder, null, ["0,0", "1,0"], ["0,0", "1,0"]).wayfinder)
      .toEqual(wayfinder);
  });

  it("allows exactly one scalar survey target on a fog tile", () => {
    expect(filterExplorationVisuals(null, "2,-1", ["0,0"], ["0,0", "2,-1"]))
      .toEqual({ wayfinder: null, surveyTargetTileKey: "2,-1" });
  });

  it("drops an out-of-world survey target", () => {
    expect(filterExplorationVisuals(null, "9,9", ["0,0"], ["0,0"]).surveyTargetTileKey).toBeNull();
  });
});
