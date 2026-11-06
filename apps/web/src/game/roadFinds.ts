import { FOREST_SURFACE_WOOD, hasPrologueEvent, type GameState } from '@mergeforge/domain';
import type { FindEffectVisual } from '@mergeforge/renderer-pixi';

export interface RoadOutcome {
  /** Finds to flash on the map, or null when the road revealed none. */
  readonly effects: readonly FindEffectVisual[] | null;
  /** Toast text for the player, or null when nothing noteworthy happened. */
  readonly message: string | null;
}

/** What a freshly built road uncovered: surface finds and the dead relay. */
export function describeRoadOutcome(before: GameState, after: GameState): RoadOutcome {
  const relayWasDiscovered = hasPrologueEvent(before, 'relay_discovered');
  const previousFinds = new Set(before.claimedSurfaceFindTileKeys);
  const relayJustDiscovered = !relayWasDiscovered && hasPrologueEvent(after, 'relay_discovered');
  const newFindKeys = after.claimedSurfaceFindTileKeys.filter((key) => !previousFinds.has(key));

  if (newFindKeys.length === 0) {
    return {
      effects: null,
      message: relayJustDiscovered ? 'Relais entdeckt · Das tote Signal liegt frei' : null,
    };
  }

  const effects: FindEffectVisual[] = [];
  let foundWood = 0;
  let foundStone = 0;
  for (const key of newFindKeys) {
    const stoneFind = before.world.surfaceFinds.find(
      (find) => find.resourceType === 'stone' && find.tileKey === key,
    );
    if (stoneFind !== undefined) {
      effects.push({ tileKey: key, resource: 'stone' });
      foundStone += stoneFind.amount;
      continue;
    }
    effects.push({ tileKey: key, resource: 'wood' });
    foundWood += FOREST_SURFACE_WOOD;
  }
  const rewards = [
    foundWood > 0 ? `+${foundWood} Holz` : null,
    foundStone > 0 ? `+${foundStone} Stein` : null,
  ].filter((reward): reward is string => reward !== null);
  const findLabel = foundWood > 0 && foundStone > 0
    ? 'Funde geborgen'
    : foundStone > 0
      ? 'Steinfund geborgen'
      : 'Fallholz geborgen';
  return {
    effects,
    message: relayJustDiscovered
      ? `Relais entdeckt · ${rewards.join(' · ')}`
      : `${findLabel} · ${rewards.join(' · ')}`,
  };
}
