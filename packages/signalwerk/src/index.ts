export const SIGNALWERK_SIZE = 5 as const;

export type SignalRotation = 0 | 1 | 2 | 3;
export type SignalDirection = "north" | "east" | "south" | "west";

export interface SignalwerkTile {
  readonly connections: readonly SignalDirection[];
}

export interface SignalwerkPuzzle {
  readonly version: 1;
  readonly seed: string;
  readonly size: typeof SIGNALWERK_SIZE;
  readonly tiles: readonly SignalwerkTile[];
  /** Blue source tile on the left edge; energy enters from west. */
  readonly sourceIndex: number;
  /** Gold target tile on the right edge; energy exits to east. */
  readonly targetIndex: number;
  readonly initialRotations: readonly SignalRotation[];
  /** Deterministic test/reference solution; gameplay still validates rotations independently. */
  readonly solutionRotations: readonly SignalRotation[];
}

const DIRECTIONS: readonly SignalDirection[] = ["north", "east", "south", "west"];
const DIRECTION_INDEX: Readonly<Record<SignalDirection, number>> = {
  north: 0,
  east: 1,
  south: 2,
  west: 3,
};
const DELTAS: Readonly<Record<SignalDirection, readonly [row: number, column: number]>> = {
  north: [-1, 0],
  east: [0, 1],
  south: [1, 0],
  west: [0, -1],
};
const OPPOSITE: Readonly<Record<SignalDirection, SignalDirection>> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};

interface GridCell {
  readonly row: number;
  readonly column: number;
}

type RandomSource = () => number;

/** Creates a deterministic, scrambled 5x5 board with at least one valid solution. */
export function createSignalwerkPuzzle(seed: string): SignalwerkPuzzle {
  const random = mulberry32(hashSeed(seed));
  const sourceIndex = indexOf(2, 0);
  const targetIndex = indexOf(2, SIGNALWERK_SIZE - 1);
  const path = createSolutionPath(random, sourceIndex, targetIndex);
  const desiredConnections = createDesiredConnections(path, sourceIndex, targetIndex, random);
  const tiles: SignalwerkTile[] = [];
  const solutionRotations: SignalRotation[] = [];
  const initialRotations: SignalRotation[] = [];

  for (let index = 0; index < desiredConnections.length; index += 1) {
    const desired = desiredConnections[index];
    if (desired === undefined) {
      throw new Error("Signalwerk generation produced an incomplete board");
    }
    const solutionRotation = randomRotation(random);
    const baseConnections = rotateDirections(desired, normalizeRotation(4 - solutionRotation));
    tiles.push({ connections: baseConnections });
    solutionRotations.push(solutionRotation);
    initialRotations.push(normalizeRotation(solutionRotation + 1 + Math.floor(random() * 3)));
  }

  // The source must be disconnected in the initial state, even if a tile's
  // rotational symmetry would otherwise make a random scramble solve it.
  const sourceTile = tiles[sourceIndex];
  if (sourceTile === undefined) {
    throw new Error("Signalwerk source tile is missing");
  }
  for (const rotation of [0, 1, 2, 3] as const) {
    if (!tileConnections(sourceTile, rotation).includes("west")) {
      initialRotations[sourceIndex] = rotation;
      break;
    }
  }

  return {
    version: 1,
    seed,
    size: SIGNALWERK_SIZE,
    tiles,
    sourceIndex,
    targetIndex,
    initialRotations,
    solutionRotations,
  };
}

/** Returns a tile's open sides after clockwise quarter-turn rotation. */
export function tileConnections(
  tile: SignalwerkTile,
  rotation: SignalRotation,
): readonly SignalDirection[] {
  return rotateDirections(tile.connections, rotation);
}

/** Returns a new serializable rotation array with one tile turned clockwise. */
export function rotateSignalwerkTile(
  rotations: readonly SignalRotation[],
  index: number,
): readonly SignalRotation[] {
  if (!Number.isInteger(index) || index < 0 || index >= rotations.length) {
    throw new RangeError(`Signalwerk tile index ${index} is outside the rotation state`);
  }
  const current = rotations[index];
  if (current === undefined || !isSignalRotation(current)) {
    throw new TypeError("Signalwerk rotation state contains an invalid value");
  }
  const next = [...rotations];
  next[index] = normalizeRotation(current + 1);
  return next;
}

/** Purely validates whether blue source energy reaches and exits the gold target. */
export function isSignalwerkSolved(
  puzzle: SignalwerkPuzzle,
  rotations: readonly SignalRotation[],
): boolean {
  if (puzzle.size !== SIGNALWERK_SIZE || puzzle.tiles.length !== SIGNALWERK_SIZE ** 2) {
    return false;
  }
  if (rotations.length !== puzzle.tiles.length || rotations.some((value) => !isSignalRotation(value))) {
    return false;
  }
  const sourceTile = puzzle.tiles[puzzle.sourceIndex];
  const targetTile = puzzle.tiles[puzzle.targetIndex];
  const sourceRotation = rotations[puzzle.sourceIndex];
  const targetRotation = rotations[puzzle.targetIndex];
  if (
    sourceTile === undefined ||
    targetTile === undefined ||
    sourceRotation === undefined ||
    targetRotation === undefined
  ) {
    return false;
  }
  if (!tileConnections(sourceTile, sourceRotation).includes("west")) {
    return false;
  }
  if (!tileConnections(targetTile, targetRotation).includes("east")) {
    return false;
  }

  const visited = new Set<number>([puzzle.sourceIndex]);
  const queue = [puzzle.sourceIndex];
  while (queue.length > 0) {
    const currentIndex = queue.shift();
    if (currentIndex === undefined) {
      break;
    }
    if (currentIndex === puzzle.targetIndex) {
      return true;
    }
    const tile = puzzle.tiles[currentIndex];
    const rotation = rotations[currentIndex];
    if (tile === undefined || rotation === undefined) {
      return false;
    }
    const row = Math.floor(currentIndex / SIGNALWERK_SIZE);
    const column = currentIndex % SIGNALWERK_SIZE;
    for (const direction of tileConnections(tile, rotation)) {
      const [rowDelta, columnDelta] = DELTAS[direction];
      const neighborRow = row + rowDelta;
      const neighborColumn = column + columnDelta;
      if (!inBounds(neighborRow, neighborColumn)) {
        continue;
      }
      const neighborIndex = indexOf(neighborRow, neighborColumn);
      if (visited.has(neighborIndex)) {
        continue;
      }
      const neighbor = puzzle.tiles[neighborIndex];
      const neighborRotation = rotations[neighborIndex];
      if (
        neighbor !== undefined &&
        neighborRotation !== undefined &&
        tileConnections(neighbor, neighborRotation).includes(OPPOSITE[direction])
      ) {
        visited.add(neighborIndex);
        queue.push(neighborIndex);
      }
    }
  }
  return false;
}

function createSolutionPath(
  random: RandomSource,
  sourceIndex: number,
  targetIndex: number,
): readonly number[] {
  const visited = new Set<number>();
  const path: number[] = [];
  const minimumLength = 9;

  const search = (index: number): boolean => {
    visited.add(index);
    path.push(index);
    if (index === targetIndex && path.length >= minimumLength) {
      return true;
    }
    const row = Math.floor(index / SIGNALWERK_SIZE);
    const column = index % SIGNALWERK_SIZE;
    const neighbors = shuffle(
      DIRECTIONS.flatMap((direction) => {
        const [rowDelta, columnDelta] = DELTAS[direction];
        const nextRow = row + rowDelta;
        const nextColumn = column + columnDelta;
        return inBounds(nextRow, nextColumn) ? [indexOf(nextRow, nextColumn)] : [];
      }),
      random,
    );
    for (const neighbor of neighbors) {
      if (visited.has(neighbor) || (neighbor === targetIndex && path.length + 1 < minimumLength)) {
        continue;
      }
      if (search(neighbor)) {
        return true;
      }
    }
    path.pop();
    visited.delete(index);
    return false;
  };

  if (!search(sourceIndex)) {
    throw new Error("Could not create a solvable Signalwerk path");
  }
  return path;
}

function createDesiredConnections(
  path: readonly number[],
  sourceIndex: number,
  targetIndex: number,
  random: RandomSource,
): readonly (readonly SignalDirection[])[] {
  const connections = Array.from({ length: SIGNALWERK_SIZE ** 2 }, () => randomDecoy(random));
  for (let position = 0; position < path.length; position += 1) {
    const index = path[position];
    if (index === undefined) {
      continue;
    }
    const tileConnections = new Set<SignalDirection>();
    const previous = path[position - 1];
    const next = path[position + 1];
    if (previous !== undefined) {
      tileConnections.add(directionBetween(index, previous));
    }
    if (next !== undefined) {
      tileConnections.add(directionBetween(index, next));
    }
    if (index === sourceIndex) {
      tileConnections.add("west");
    }
    if (index === targetIndex) {
      tileConnections.add("east");
    }
    connections[index] = sortDirections([...tileConnections]);
  }
  return connections;
}

function randomDecoy(random: RandomSource): readonly SignalDirection[] {
  const shapes: readonly (readonly SignalDirection[])[] = [
    ["north", "south"],
    ["north", "east"],
    ["north", "east", "west"],
    ["north"],
  ];
  const shape = shapes[Math.floor(random() * shapes.length)] ?? shapes[0];
  if (shape === undefined) {
    throw new Error("Signalwerk decoy shape is missing");
  }
  return rotateDirections(shape, randomRotation(random));
}

function directionBetween(fromIndex: number, toIndex: number): SignalDirection {
  const fromRow = Math.floor(fromIndex / SIGNALWERK_SIZE);
  const fromColumn = fromIndex % SIGNALWERK_SIZE;
  const toRow = Math.floor(toIndex / SIGNALWERK_SIZE);
  const toColumn = toIndex % SIGNALWERK_SIZE;
  if (toRow === fromRow - 1 && toColumn === fromColumn) return "north";
  if (toRow === fromRow && toColumn === fromColumn + 1) return "east";
  if (toRow === fromRow + 1 && toColumn === fromColumn) return "south";
  if (toRow === fromRow && toColumn === fromColumn - 1) return "west";
  throw new Error("Signalwerk solution path contains non-neighboring tiles");
}

function rotateDirections(
  directions: readonly SignalDirection[],
  rotation: SignalRotation,
): readonly SignalDirection[] {
  return sortDirections(
    directions.map((direction) => DIRECTIONS[(DIRECTION_INDEX[direction] + rotation) % 4] ?? direction),
  );
}

function sortDirections(directions: readonly SignalDirection[]): readonly SignalDirection[] {
  return [...directions].sort((left, right) => DIRECTION_INDEX[left] - DIRECTION_INDEX[right]);
}

function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const value = shuffled[index];
    const otherValue = shuffled[other];
    if (value !== undefined && otherValue !== undefined) {
      shuffled[index] = otherValue;
      shuffled[other] = value;
    }
  }
  return shuffled;
}

function randomRotation(random: RandomSource): SignalRotation {
  return normalizeRotation(Math.floor(random() * 4));
}

function normalizeRotation(value: number): SignalRotation {
  return (((value % 4) + 4) % 4) as SignalRotation;
}

function isSignalRotation(value: number): value is SignalRotation {
  return Number.isInteger(value) && value >= 0 && value <= 3;
}

function inBounds(row: number, column: number): boolean {
  return row >= 0 && row < SIGNALWERK_SIZE && column >= 0 && column < SIGNALWERK_SIZE;
}

function indexOf(row: number, column: number): number {
  return row * SIGNALWERK_SIZE + column;
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): RandomSource {
  let value = seed;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}
