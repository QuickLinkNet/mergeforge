import { hasCompletedChapter, hasPrologueEvent, type GameState } from '@mergeforge/domain';
import { describeChapterEight } from './missionChapter8';
import { relayHint } from './relayHint';

export const CHAPTER_ONE_ROAD_TARGET = 2;

/** Everything the mission card and the top bar say about the current chapter. */
export interface Mission {
  readonly chapterNumber: number;
  readonly chapterName: string;
  readonly title: string;
  readonly description: string;
  readonly objective: string;
  readonly progress: string;
  readonly complete: boolean;
  readonly note: string;
}

/** Pure text logic of the chapter card. A missing state reads like a fresh game (chapter 1). */
export function describeMission(gameState: GameState | null): Mission {
  const roadsBuilt = gameState?.roadTileKeys.length ?? 0;
  const chapterProgress = Math.min(roadsBuilt, CHAPTER_ONE_ROAD_TARGET);
  const chapterComplete = chapterProgress === CHAPTER_ONE_ROAD_TARGET;
  const hasLumberCamp = gameState?.buildings.some((building) => building.type === 'lumber-camp') ?? false;
  const stoneProductionObserved = gameState?.prologue.stoneProductionObserved ?? false;
  const surveysCompleted = gameState?.prologue.pathfinderSurveysCompleted ?? 0;
  const chapterThreeComplete = gameState === null ? false : hasCompletedChapter(gameState, 3);
  const chapterFourComplete = gameState === null ? false : hasCompletedChapter(gameState, 4);
  const chapterFiveComplete = gameState === null ? false : hasCompletedChapter(gameState, 5);
  const chapterSixComplete = gameState === null ? false : hasCompletedChapter(gameState, 6);
  const chapterSevenComplete = gameState === null ? false : hasCompletedChapter(gameState, 7);
  const signalwerkSolved = gameState?.signalwerk.solved ?? false;
  const relayStatus = gameState?.relay.status ?? 'dormant';
  const workshop = gameState?.buildings.find((building) => building.type === 'workshop');
  const surveyTent = gameState?.buildings.find((building) => building.type === 'survey-tent');
  const surveyTentActive = surveyTent?.status === 'active';
  const workshopActive = workshop?.status === 'active';
  const relayDiscovered = gameState === null ? false : hasPrologueEvent(gameState, 'relay_discovered');
  const relayVisible = gameState?.visibleTileKeys.includes(gameState.world.relaySite.tileKey) ?? false;
  const farSignals = gameState?.signals ?? [];

  const prologueChapter = !chapterThreeComplete ? 3 : !chapterFourComplete ? 4 : !chapterFiveComplete ? 5 : !chapterSixComplete ? 6 : 7;
  const chapterNumber = !chapterComplete ? 1 : !hasLumberCamp ? 2 : prologueChapter;
  // After the scan (chapter 7) the game goes on with chapter 8 and its own texts.
  if (chapterNumber === 7 && chapterSevenComplete && gameState !== null) return describeChapterEight(gameState);
  const chapterName = chapterNumber === 1
    ? 'Gründungsring'
    : chapterNumber === 2
      ? 'Waldlinie'
      : chapterNumber === 3
        ? 'Steinlinie'
        : chapterNumber === 4
          ? 'Weggabel'
          : chapterNumber === 5
            ? 'Totes Signal'
            : chapterNumber === 6
              ? 'Resonanzkern'
              : 'Erstes Signal';
  const title = chapterNumber === 1
    ? 'Ein Weg ins Unbekannte'
    : chapterNumber === 2
      ? 'Die Waldlinie'
      : chapterNumber === 3
        ? 'Stein und Sicht'
        : chapterNumber === 4
          ? 'Die Weggabel'
          : chapterFiveComplete
            ? chapterSixComplete
              ? 'Das erste Signal'
              : signalwerkSolved
                ? 'Der Resonanzkern'
                : 'Das Signalwerk'
            : 'Das tote Signal';
  const description = chapterNumber === 1
    ? 'Wählt ein sichtbares Feld neben dem Dorf oder einer Straße. Jede Straße öffnet den Nebel entlang eures Weges.'
    : chapterNumber === 2
      ? 'Verbindet ein Waldfeld mit eurem Straßennetz und errichtet das erste Holzfällerlager.'
      : chapterNumber === 3
        ? 'Sichert die erste Steinproduktion und beweist den Wegfinder mit einer einzelnen Vermessung.'
        : chapterNumber === 4
          ? 'Baut das Straßennetz auf acht Felder aus und aktiviert das Vermesserzelt.'
          : chapterFiveComplete
            ? chapterSixComplete
              ? chapterSevenComplete
                ? 'Das Relais empfängt zwei ferne Siedlungen. Ihre Karten bleiben im Nebel; bekannt sind nur Richtung und grobe Entfernung.'
                : 'Das Relais ist wieder aktiv. Lauscht in die Ferne: Ein Scan zeigt, in welcher Richtung zwei andere Siedlungen liegen.'
              : signalwerkSolved
                ? 'Errichtet die Werkstatt, installiert den einzigartigen Kern und repariert anschließend das Relais.'
                : 'Wählt das entdeckte Relais und richtet im Signalwerk eine durchgehende Energieverbindung ein.'
            : `Folgt Straße und Wegfinder tiefer in den Nebel, bis die verlassene Relaisstation sichtbar wird. ${gameState === null ? '' : relayHint(gameState)}`;
  const objective = chapterNumber === 1
    ? 'Zwei Straßenfelder errichten'
    : chapterNumber === 2
      ? 'Holzfällerlager beauftragen'
      : chapterNumber === 3
        ? !stoneProductionObserved
          ? 'Erste Steinproduktion erhalten'
          : 'Ein Nebelhex vermessen'
        : chapterNumber === 4
          ? roadsBuilt < 8
            ? 'Acht Straßenfelder verbinden'
            : 'Vermesserzelt aktivieren'
          : chapterFiveComplete
            ? !signalwerkSolved
              ? 'Signalwerk lösen'
              : workshop === undefined
                ? 'Werkstatt errichten'
                : workshop.status === 'constructing'
                  ? 'Werkstatt fertigstellen'
                  : relayStatus === 'dormant'
                    ? 'Resonanzkern installieren und Relais reparieren'
                    : relayStatus === 'repairing'
                      ? 'Relaisreparatur abschließen'
                      : chapterSevenComplete
                        ? 'Zwei Fernsignale empfangen'
                        : 'Fernsignal scannen'
            : 'Verlassenes Relais aufdecken';
  const chapterSixProgress = Number(signalwerkSolved) + Number(workshopActive) + Number(relayStatus === 'active');
  const progress = chapterNumber === 1
    ? `${chapterProgress} / ${CHAPTER_ONE_ROAD_TARGET}`
    : chapterNumber === 2
      ? '0 / 1'
      : chapterNumber === 3
        ? `${Number(stoneProductionObserved) + Number(surveysCompleted >= 1)} / 2`
        : chapterNumber === 4
          ? roadsBuilt < 8
            ? `${Math.min(roadsBuilt, 8)} / 8`
            : `${surveyTentActive ? 1 : 0} / 1`
          : chapterFiveComplete
            ? chapterSixComplete
              ? `${farSignals.length} / 2`
              : `${chapterSixProgress} / 3`
            : `${relayDiscovered && relayVisible ? 1 : 0} / 1`;
  const complete = chapterNumber === 7 && chapterSevenComplete;
  const note = chapterNumber === 1
    ? 'Straßen kosten 1 Holz und decken angrenzende Felder auf.'
    : chapterNumber === 2
      ? 'Das Holzfällerlager kostet 4 Holz und 1 Stein.'
      : chapterNumber === 3
        ? `Steinproduktion ${stoneProductionObserved ? '✓' : '◇'} · Vermessungen ${Math.min(surveysCompleted, 1)} / 1`
        : chapterNumber === 4
          ? `Straßen ${Math.min(roadsBuilt, 8)} / 8 · Vermesserzelt ${surveyTentActive ? '✓' : '◇'}`
          : chapterFiveComplete
            ? chapterSixComplete
              ? chapterSevenComplete
                ? 'Signalnetz aktiv · Fremde Karten und Koordinaten bleiben verborgen.'
                : 'Der Scan kostet nichts und läuft sofort · Es werden nur Richtung und grobe Entfernung gezeigt.'
              : signalwerkSolved
                ? 'Werkstatt: 6 Holz, 4 Stein, 20 Min. · Reparatur: 5 Holz, 6 Stein, 30 Min.'
                : 'Das 5×5-Raster bleibt beim Schließen und nach einem Reload unverändert erhalten.'
            : 'Das Relais wird erst sichtbar, wenn sein Hex durch Straße oder Vermessung aufgedeckt wurde.';

  return { chapterNumber, chapterName, title, description, objective, progress, complete, note };
}
