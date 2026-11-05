import { axialNeighbors, type GameState, type HexCoord } from '@mergeforge/domain';
const keyToCoord = (key: string): HexCoord => {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
};

export interface PathfinderGuidance {
  /** One plain sentence telling the player what to do next. */
  readonly text: string;
  /** Map fields worth highlighting for that step (may be empty). */
  readonly highlightKeys: readonly string[];
}

const keyOf = (coord: HexCoord) => `${coord.q},${coord.r}`;

function distance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/**
 * What the player should do with the pathfinder next. Null once the first survey is done
 * or when there is no active pathfinder. Mirrors the survey rules of the domain: the
 * pathfinder must stand on a road end and can only survey a hidden field two steps away.
 */
export function pathfinderGuidance(state: GameState): PathfinderGuidance | null {
  const pathfinder = state.units.find((unit) => unit.type === 'pathfinder');
  if (pathfinder === undefined || pathfinder.status !== 'active') return null;
  if (state.prologue.pathfinderSurveysCompleted >= 1) return null;

  const villageKey = keyOf(state.world.village.coord);
  const network = new Set([...state.roadTileKeys, villageKey]);
  const isRoadEnd = (key: string): boolean => {
    if (!state.roadTileKeys.includes(key)) return false;
    const neighbours = axialNeighbors(keyToCoord(key)).filter((coord) => network.has(keyOf(coord))).length;
    return neighbours <= 1;
  };

  if (pathfinder.charges < 1) {
    return {
      text: 'Der Wegfinder hat keine Ladung. Pro Takt (10 Minuten) kommt eine dazu.',
      highlightKeys: [],
    };
  }

  if (!isRoadEnd(pathfinder.tileKey)) {
    return {
      text: 'Schritt 1 von 2: Klicke das äußerste Straßenfeld (das Ende einer Straße) und dann „Wegfinder bewegen“.',
      highlightKeys: state.roadTileKeys.filter(isRoadEnd),
    };
  }

  const here = keyToCoord(pathfinder.tileKey);
  const targets = state.world.tiles
    .filter((tile) => distance(tile.coord, here) === 2 && !state.visibleTileKeys.includes(keyOf(tile.coord)))
    .map((tile) => keyOf(tile.coord));
  if (targets.length === 0) {
    return {
      text: 'Hier gibt es nichts zu vermessen. Baue die Straße weiter aus oder bewege den Wegfinder zu einem anderen Straßenende.',
      highlightKeys: state.roadTileKeys.filter((key) => isRoadEnd(key) && key !== pathfinder.tileKey),
    };
  }
  return {
    text: 'Schritt 2 von 2: Klicke ein Nebelfeld, das zwei Felder vom Wegfinder entfernt liegt, und dann „Jetzt vermessen“.',
    highlightKeys: targets,
  };
}
