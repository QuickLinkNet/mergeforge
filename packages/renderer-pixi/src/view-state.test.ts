import { describe, expect, it } from "vitest";

import { initialViewState, patchViewState } from "./view-state.js";

describe("renderer view state", () => {
  it("provides inert defaults", () => {
    expect(initialViewState(undefined)).toEqual({
      selectedTileKey: null,
      roadTileKeys: [],
      roadPreviewTileKeys: [],
      lumberCamps: [],
      woodFindTileKeys: [],
    });
  });

  it("patches one overlay without erasing the others", () => {
    const initial = initialViewState({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0"],
      roadPreviewTileKeys: ["2,0"],
      lumberCamps: [{ tileKey: "1,0", state: "construction" }],
      woodFindTileKeys: ["0,1"],
    });

    expect(patchViewState(initial, { roadTileKeys: ["1,0", "2,0"] })).toEqual({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0", "2,0"],
      roadPreviewTileKeys: ["2,0"],
      lumberCamps: [{ tileKey: "1,0", state: "construction" }],
      woodFindTileKeys: ["0,1"],
    });
  });

  it("clears a controlled selection explicitly with null", () => {
    const initial = initialViewState({ selectedTileKey: "3,-1" });
    expect(patchViewState(initial, { selectedTileKey: null }).selectedTileKey).toBeNull();
  });

  it("updates and clears lumber visuals without changing roads", () => {
    const initial = initialViewState({
      roadTileKeys: ["1,0"],
      lumberCamps: [{ tileKey: "2,0", state: "construction" }],
      woodFindTileKeys: ["1,-1"],
    });
    const complete = patchViewState(initial, {
      lumberCamps: [{ tileKey: "2,0", state: "complete" }],
      woodFindTileKeys: [],
    });

    expect(complete.roadTileKeys).toEqual(["1,0"]);
    expect(complete.lumberCamps).toEqual([{ tileKey: "2,0", state: "complete" }]);
    expect(complete.woodFindTileKeys).toEqual([]);
  });
});
