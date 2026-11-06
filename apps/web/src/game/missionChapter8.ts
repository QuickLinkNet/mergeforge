import {
  findProductionUpgrade,
  findStorehouse,
  hasCompletedChapter,
  type GameState,
} from '@mergeforge/domain';
import type { Mission } from './mission';

export const CHAPTER_EIGHT_NAME = 'Gründerwerk';
/** The outlook the finished chapter ends with (phase C: the neighbours come closer). */
export const NEIGHBOUR_OUTLOOK = 'Im Funkverkehr zeichnet sich ab, dass jemand näher kommt.';

/** Chapter 8 "Das Gründerwerk": storehouse level 1 plus both production upgrades. */
export function describeChapterEight(state: GameState): Mission {
  const storehouse = findStorehouse(state);
  const lumberUpgrade = findProductionUpgrade(state, 'lumber-upgrade');
  const quarryUpgrade = findProductionUpgrade(state, 'quarry-upgrade');
  const storehouseDone = storehouse !== undefined && (storehouse.status === 'active' || storehouse.level > 1);
  const lumberDone = lumberUpgrade?.status === 'active';
  const quarryDone = quarryUpgrade?.status === 'active';
  const complete = hasCompletedChapter(state, 8);
  const doneCount = Number(storehouseDone) + Number(lumberDone) + Number(quarryDone);
  const mark = (done: boolean) => (done ? '✓' : '◇');

  const objective = complete
    ? 'Gründerwerk vollendet'
    : !storehouseDone
      ? storehouse === undefined ? 'Lagerhaus Stufe 1 errichten' : 'Lagerhaus Stufe 1 fertigstellen'
      : !lumberDone
        ? lumberUpgrade === undefined ? 'Holzfäller ausbauen' : 'Holzfäller-Ausbau fertigstellen'
        : quarryUpgrade === undefined ? 'Steinbruch ausbauen' : 'Steinbruch-Ausbau fertigstellen';

  return {
    chapterNumber: 8,
    chapterName: CHAPTER_EIGHT_NAME,
    title: 'Das Gründerwerk',
    description: complete
      ? `Lagerhaus, Holzfäller und Steinbruch sind ausgebaut: Das Dorf steht auf festem Grund. ${NEIGHBOUR_OUTLOOK}`
      : 'Das Lager quillt über. Baut im Dorf ein Lagerhaus und bringt Holzfällerlager und Steinbruch auf die nächste Stufe. Alles startet im Baumenü und nutzt den einen Bauplatz.',
    objective,
    progress: `${doneCount} / 3`,
    complete,
    note: complete
      ? 'Weitere Lagerhaus-Stufen bleiben im Baumenü verfügbar (bis Stufe 3).'
      : `Lagerhaus ${mark(storehouseDone)} · Holzfäller-Ausbau ${mark(lumberDone)} · Steinbruch-Ausbau ${mark(quarryDone)}`,
  };
}
