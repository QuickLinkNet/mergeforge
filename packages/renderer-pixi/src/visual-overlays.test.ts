import { describe, expect, it } from "vitest";

import { filterVisibleVisualOverlays } from "./visual-overlays.js";

describe("visible renderer overlays", () => {
  it("filters buildings and effects outside visible world tiles", () => {
    const result = filterVisibleVisualOverlays(
      [
        { tileKey: "1,0", type: "lumber-camp", state: "complete" },
        { tileKey: "3,0", type: "quarry", state: "construction" },
      ],
      [
        { tileKey: "1,0", resource: "wood" },
        { tileKey: "2,0", resource: "stone" },
      ],
      ["0,0", "1,0", "2,0"],
      ["0,0", "1,0", "3,0"],
    );

    expect(result).toEqual({
      buildings: [{ tileKey: "1,0", type: "lumber-camp", state: "complete" }],
      findEffects: [{ tileKey: "1,0", resource: "wood" }],
    });
  });

  it("keeps the last building per tile and deduplicates identical effects", () => {
    const result = filterVisibleVisualOverlays(
      [
        { tileKey: "2,-1", type: "quarry", state: "construction" },
        { tileKey: "2,-1", type: "quarry", state: "complete" },
      ],
      [
        { tileKey: "2,-1", resource: "stone" },
        { tileKey: "2,-1", resource: "stone" },
      ],
      ["2,-1"],
      ["2,-1"],
    );

    expect(result.buildings).toEqual([{ tileKey: "2,-1", type: "quarry", state: "complete" }]);
    expect(result.findEffects).toEqual([{ tileKey: "2,-1", resource: "stone" }]);
  });
});
