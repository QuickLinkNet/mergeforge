import type { GameState, HexCoord } from '@mergeforge/domain';

const DIRECTIONS = ['Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten', 'Norden', 'Nordosten'] as const;

function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Compass direction of `to` seen from `from` on screen (pointy-top hexes, north is up). */
export function compassDirection(from: HexCoord, to: HexCoord): string {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  const x = Math.sqrt(3) * (dq + dr / 2);
  const y = 1.5 * dr;
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const index = Math.round(((angle + 360) % 360) / 45) % 8;
  return DIRECTIONS[index] ?? 'Osten';
}

/** Where the dead signal comes from: direction and rough distance from the village. */
export function relayHint(state: GameState): string {
  const [q, r] = state.world.relaySite.tileKey.split(',').map(Number);
  const relay = { q: q ?? 0, r: r ?? 0 };
  const village = state.world.village.coord;
  const rough = Math.max(3, Math.round(hexDistance(village, relay) / 2) * 2);
  return `Das Signal kommt aus Richtung ${compassDirection(village, relay)}, etwa ${rough} Felder vom Dorf entfernt.`;
}
