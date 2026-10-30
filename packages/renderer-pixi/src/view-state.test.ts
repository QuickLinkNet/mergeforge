import { describe, expect, it } from "vitest";

import { initialViewState, patchViewState } from "./view-state.js";

describe("renderer view state", () => {
  it("provides inert defaults", () => {
    expect(initialViewState(undefined)).toEqual({
      selectedTileKey: null,
      roadTileKeys: [],
      roadPreviewTileKeys: [],
    });
  });

  it("patches one overlay without erasing the others", () => {
    const initial = initialViewState({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0"],
      roadPreviewTileKeys: ["2,0"],
    });

    expect(patchViewState(initial, { roadTileKeys: ["1,0", "2,0"] })).toEqual({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0", "2,0"],
      roadPreviewTileKeys: ["2,0"],
    });
  });

  it("clears a controlled selection explicitly with null", () => {
    const initial = initialViewState({ selectedTileKey: "3,-1" });
    expect(patchViewState(initial, { selectedTileKey: null }).selectedTileKey).toBeNull();
  });
});
