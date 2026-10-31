import { describe, expect, it } from "vitest";

import { initialViewState, patchViewState } from "./view-state.js";

describe("renderer view state", () => {
  it("provides inert defaults", () => {
    expect(initialViewState(undefined)).toEqual({
      selectedTileKey: null,
      roadTileKeys: [],
      roadPreviewTileKeys: [],
      buildings: [],
      findEffects: [],
    });
  });

  it("patches one overlay without erasing the others", () => {
    const initial = initialViewState({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0"],
      roadPreviewTileKeys: ["2,0"],
      buildings: [{ tileKey: "1,0", type: "lumber-camp", state: "construction" }],
      findEffects: [{ tileKey: "0,1", resource: "wood" }],
    });

    expect(patchViewState(initial, { roadTileKeys: ["1,0", "2,0"] })).toEqual({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0", "2,0"],
      roadPreviewTileKeys: ["2,0"],
      buildings: [{ tileKey: "1,0", type: "lumber-camp", state: "construction" }],
      findEffects: [{ tileKey: "0,1", resource: "wood" }],
    });
  });

  it("clears a controlled selection explicitly with null", () => {
    const initial = initialViewState({ selectedTileKey: "3,-1" });
    expect(patchViewState(initial, { selectedTileKey: null }).selectedTileKey).toBeNull();
  });

  it("updates and clears data-driven visuals without changing roads", () => {
    const initial = initialViewState({
      roadTileKeys: ["1,0"],
      buildings: [{ tileKey: "2,0", type: "quarry", state: "construction" }],
      findEffects: [{ tileKey: "1,-1", resource: "stone" }],
    });
    const complete = patchViewState(initial, {
      buildings: [{ tileKey: "2,0", type: "quarry", state: "complete" }],
      findEffects: [],
    });

    expect(complete.roadTileKeys).toEqual(["1,0"]);
    expect(complete.buildings).toEqual([{ tileKey: "2,0", type: "quarry", state: "complete" }]);
    expect(complete.findEffects).toEqual([]);
  });
});
