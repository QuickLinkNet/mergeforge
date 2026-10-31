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
      wayfinder: null,
      surveyTargetTileKey: null,
      surveyTent: null,
    });
  });

  it("patches one overlay without erasing the others", () => {
    const initial = initialViewState({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0"],
      roadPreviewTileKeys: ["2,0"],
      buildings: [{ tileKey: "1,0", type: "lumber-camp", state: "construction" }],
      findEffects: [{ tileKey: "0,1", resource: "wood" }],
      wayfinder: { tileKey: "0,0", state: "training" },
      surveyTargetTileKey: "2,-1",
      surveyTent: { state: "construction" },
    });

    expect(patchViewState(initial, { roadTileKeys: ["1,0", "2,0"] })).toEqual({
      selectedTileKey: "0,0",
      roadTileKeys: ["1,0", "2,0"],
      roadPreviewTileKeys: ["2,0"],
      buildings: [{ tileKey: "1,0", type: "lumber-camp", state: "construction" }],
      findEffects: [{ tileKey: "0,1", resource: "wood" }],
      wayfinder: { tileKey: "0,0", state: "training" },
      surveyTargetTileKey: "2,-1",
      surveyTent: { state: "construction" },
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

  it("updates and explicitly clears exploration visuals", () => {
    const initial = initialViewState({
      wayfinder: { tileKey: "0,0", state: "training" },
      surveyTargetTileKey: "1,-1",
      surveyTent: { state: "construction" },
    });
    const active = patchViewState(initial, {
      wayfinder: { tileKey: "1,0", state: "active" },
      surveyTent: { state: "complete" },
    });

    expect(active.wayfinder).toEqual({ tileKey: "1,0", state: "active" });
    expect(active.surveyTargetTileKey).toBe("1,-1");
    expect(active.surveyTent).toEqual({ state: "complete" });
    expect(
      patchViewState(active, {
        wayfinder: null,
        surveyTargetTileKey: null,
        surveyTent: null,
      }),
    ).toMatchObject({ wayfinder: null, surveyTargetTileKey: null, surveyTent: null });
  });
});
