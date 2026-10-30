import { describe, expect, it } from "vitest";

import { axialNeighbors, hexKey } from "./index";

describe("axial hex primitives", () => {
  it("uses a stable coordinate key", () => {
    expect(hexKey({ q: -2, r: 4 })).toBe("-2,4");
  });

  it("returns six unique neighbors in canonical order", () => {
    const neighbors = axialNeighbors({ q: 0, r: 0 });

    expect(neighbors.map(hexKey)).toEqual([
      "1,0",
      "1,-1",
      "0,-1",
      "-1,0",
      "-1,1",
      "0,1",
    ]);
  });
});
