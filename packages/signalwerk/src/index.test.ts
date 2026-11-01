import { describe, expect, it } from "vitest";

import {
  createSignalwerkPuzzle,
  isSignalwerkSolved,
  rotateSignalwerkTile,
  tileConnections,
} from "./index.js";

describe("Signalwerk puzzle", () => {
  it("generates identical serializable puzzles for the same seed", () => {
    const first = createSignalwerkPuzzle("relay:genesis:17");
    const second = createSignalwerkPuzzle("relay:genesis:17");

    expect(second).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(createSignalwerkPuzzle("relay:genesis:18")).not.toEqual(first);
  });

  it("provides a valid known solution for every generated board", () => {
    for (const seed of ["alpha", "beta", "gamma", "world-001", ""]) {
      const puzzle = createSignalwerkPuzzle(seed);
      expect(puzzle.tiles).toHaveLength(25);
      expect(puzzle.initialRotations).toHaveLength(25);
      expect(isSignalwerkSolved(puzzle, puzzle.solutionRotations)).toBe(true);
      expect(isSignalwerkSolved(puzzle, puzzle.initialRotations)).toBe(false);
    }
  });

  it("rejects a wrong rotation on the solved source tile", () => {
    const puzzle = createSignalwerkPuzzle("wrong-turn");
    const wrong = rotateSignalwerkTile(puzzle.solutionRotations, puzzle.sourceIndex);

    expect(isSignalwerkSolved(puzzle, wrong)).toBe(false);
  });

  it("rotates clockwise modulo four without mutating the input", () => {
    const puzzle = createSignalwerkPuzzle("quarter-turns");
    const original = puzzle.initialRotations;
    let rotations = original;
    for (let turn = 0; turn < 4; turn += 1) {
      rotations = rotateSignalwerkTile(rotations, 7);
    }

    expect(rotations).toEqual(original);
    expect(puzzle.initialRotations).toBe(original);
  });

  it("exposes stable rotated connector directions", () => {
    const tile = { connections: ["north", "east"] as const };
    expect(tileConnections(tile, 0)).toEqual(["north", "east"]);
    expect(tileConnections(tile, 1)).toEqual(["east", "south"]);
    expect(tileConnections(tile, 3)).toEqual(["north", "west"]);
  });
});
