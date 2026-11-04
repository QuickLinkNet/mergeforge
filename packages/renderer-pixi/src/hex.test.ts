import { describe, expect, it } from "vitest";

import { axialKey, axialToPixel, hexCorners, pixelToAxial } from "./hex.js";

describe("axial hex projection", () => {
  it("maps the origin and known pointy-top neighbors stably", () => {
    const size = 32;

    expect(axialToPixel({ q: 0, r: 0 }, size)).toEqual({ x: 0, y: 0 });
    expect(axialToPixel({ q: 1, r: 0 }, size).x).toBeCloseTo(Math.sqrt(3) * size);
    expect(axialToPixel({ q: 1, r: 0 }, size).y).toBe(0);
    expect(axialToPixel({ q: 0, r: 1 }, size).x).toBeCloseTo((Math.sqrt(3) * size) / 2);
    expect(axialToPixel({ q: 0, r: 1 }, size).y).toBe(1.5 * size);
  });

  it("keeps every adjacent center distinct at the same distance", () => {
    const size = 27;
    const origin = axialToPixel({ q: 0, r: 0 }, size);
    const neighbors = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ].map((coord) => axialToPixel(coord, size));

    expect(new Set(neighbors.map(({ x, y }) => `${x.toFixed(6)},${y.toFixed(6)}`)).size).toBe(6);
    for (const neighbor of neighbors) {
      expect(Math.hypot(neighbor.x - origin.x, neighbor.y - origin.y)).toBeCloseTo(
        Math.sqrt(3) * size,
      );
    }
  });

  it("gives every neighboring hex exactly one shared edge", () => {
    const size = 42;
    const originCorners = hexCorners(axialToPixel({ q: 0, r: 0 }, size), size);
    const neighbors = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ];

    for (const neighbor of neighbors) {
      const neighborCorners = hexCorners(axialToPixel(neighbor, size), size);
      const sharedCorners = originCorners.filter((originCorner) =>
        neighborCorners.some(
          (neighborCorner) =>
            Math.abs(originCorner.x - neighborCorner.x) < 0.000_001 &&
            Math.abs(originCorner.y - neighborCorner.y) < 0.000_001,
        ),
      );

      expect(sharedCorners).toHaveLength(2);
    }
  });

  it("round-trips projected centers and resolves points inside a hex", () => {
    const size = 42;
    for (const coord of [
      { q: 0, r: 0 },
      { q: 4, r: -2 },
      { q: -3, r: 5 },
    ]) {
      const center = axialToPixel(coord, size);
      expect(pixelToAxial(center, size)).toEqual(coord);
      expect(pixelToAxial({ x: center.x + 5, y: center.y - 4 }, size)).toEqual(coord);
    }
  });

  it("produces six corners and stable coordinate keys", () => {
    expect(hexCorners({ x: 10, y: 20 }, 12)).toHaveLength(6);
    expect(axialKey({ q: -3, r: 8 })).toBe("-3,8");
  });
});
