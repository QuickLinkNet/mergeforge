import { axialNeighbors, hasCompletedChapter, hasPrologueEvent, type GameState, type HexCoord } from '@mergeforge/domain';
import { compassDirection } from './relayHint';
import type { PathfinderGuidance } from './pathfinderGuidance';

const keyOf = (coord: HexCoord): string => `${coord.q},${coord.r}`;

function coordOf(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

/** Steps from every walkable tile to the relay (breadth-first over land, from the relay outwards). */
function distancesToRelay(state: GameState): Map<string, number> {
  const walkable = new Set(state.world.tiles.filter((tile) => tile.terrain !== 'water').map((tile) => keyOf(tile.coord)));
  const start = state.world.relaySite.tileKey;
  const distances = new Map<string, number>([[start, 0]]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const key = queue[index] as string;
    const steps = (distances.get(key) ?? 0) + 1;
    for (const neighbour of axialNeighbors(coordOf(key))) {
      const next = keyOf(neighbour);
      if (!walkable.has(next) || distances.has(next)) continue;
      distances.set(next, steps);
      queue.push(next);
    }
  }
  return distances;
}

/**
 * Chapter 5 help: which road field to build next to reach the abandoned relay. Null outside
 * chapter 5. It looks at the shortest land route, so water in the way is handled for the player.
 */
export function relayGuidance(state: GameState): PathfinderGuidance | null {
  if (!hasCompletedChapter(state, 4) || hasCompletedChapter(state, 5)) return null;
  if (hasPrologueEvent(state, 'relay_discovered')) return null;

  const distances = distancesToRelay(state);
  const network = new Set([...state.roadTileKeys, keyOf(state.world.village.coord)]);
  const visible = new Set(state.visibleTileKeys);
  const roads = new Set(state.roadTileKeys);
  const village = keyOf(state.world.village.coord);
  const candidates = new Set<string>();
  for (const key of network) {
    for (const neighbour of axialNeighbors(coordOf(key))) {
      const next = keyOf(neighbour);
      if (visible.has(next) && !roads.has(next) && next !== village && distances.has(next)) candidates.add(next);
    }
  }
  let best = Number.POSITIVE_INFINITY;
  for (const key of candidates) best = Math.min(best, distances.get(key) ?? best);
  if (!Number.isFinite(best)) return null;
  const highlightKeys = [...candidates].filter((key) => distances.get(key) === best);

  const direction = compassDirection(coordOf(highlightKeys[0] as string), coordOf(state.world.relaySite.tileKey));
  const remaining = best === 0 ? 'Das nächste Feld ist die Relaisstation.' : `Noch etwa ${best} Straßenfelder bis zur Station, Richtung ${direction}.`;
  const wood = state.resources.wood < 1 ? ' Du brauchst 1 Holz pro Straße.' : '';
  return {
    step: 'relay',
    text: `Baue die Straße auf einem markierten Feld weiter. ${remaining}${wood}`,
    highlightKeys,
  };
}
