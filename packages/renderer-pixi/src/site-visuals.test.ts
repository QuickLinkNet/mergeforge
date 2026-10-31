import { describe, expect, it } from "vitest";

import { visibleWorldSites } from "./site-visuals.js";

describe("world site visual discovery", () => {
  const source = {
    resourceSites: [
      { id: "stone-near", type: "stone" as const, tileKey: "2,-1" },
      { id: "stone-far", type: "stone" as const, tileKey: "5,-3" },
    ],
    relaySite: { id: "relay-1", tileKey: "6,-2" },
  };

  it("returns only stone sites on visible tiles", () => {
    expect(visibleWorldSites(source, ["0,0", "2,-1"])).toEqual({
      stoneSites: [{ id: "stone-near", type: "stone", tileKey: "2,-1" }],
      relaySite: null,
    });
  });

  it("keeps the relay hidden until its own tile is visible", () => {
    expect(visibleWorldSites(source, ["5,-3"]).relaySite).toBeNull();
    expect(visibleWorldSites(source, ["6,-2"]).relaySite).toEqual({
      id: "relay-1",
      tileKey: "6,-2",
    });
  });
});
