import { storageLimits, type Building, type GameState } from '@mergeforge/domain';

/**
 * Consistency of the phase B sinks (schema 8, D-023) in an otherwise parsed save:
 * storehouse and upgrades only after chapter 7, upgrades only with their active
 * producer, the stock within the storage of the finished storehouse level and
 * chapter 8 exactly when its goals are met. Returns false for a manipulated save.
 */
export function hasConsistentSinks(state: GameState): boolean {
  const { buildings, prologue, resources } = state;
  const find = (type: Building['type']) => buildings.find((building) => building.type === type);
  const storehouse = find('storehouse');
  const lumberUpgrade = find('lumber-upgrade');
  const quarryUpgrade = find('quarry-upgrade');
  const chapterSeven = prologue.completedChapterIds.includes(7);
  const chapterEight = prologue.completedChapterIds.includes(8);
  const activeProducer = (type: 'lumber-camp' | 'quarry') =>
    buildings.some((building) => building.type === type && building.status === 'active');

  if ((storehouse !== undefined || lumberUpgrade !== undefined || quarryUpgrade !== undefined) && !chapterSeven) return false;
  if (lumberUpgrade !== undefined && !activeProducer('lumber-camp')) return false;
  if (quarryUpgrade !== undefined && !activeProducer('quarry')) return false;

  const limits = storageLimits(state);
  if (resources.wood > limits.wood || resources.stone > limits.stone) return false;

  const storehouseReady =
    storehouse?.type === 'storehouse' && (storehouse.status === 'active' || storehouse.level > 1);
  const goalsMet =
    storehouseReady && lumberUpgrade?.status === 'active' && quarryUpgrade?.status === 'active';
  if (chapterEight !== prologue.eventIds.includes('founders_works_completed')) return false;
  if (chapterEight && !goalsMet) return false;
  return true;
}
