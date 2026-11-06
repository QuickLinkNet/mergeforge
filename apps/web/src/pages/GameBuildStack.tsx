import { BuildingPlanCard, BuildingStatusCard } from '../components/organisms/BuildingCards/BuildingCards';
import { MarketPanel } from '../components/organisms/MarketPanel/MarketPanel';
import { ModuleBuildPanel } from '../components/organisms/ModuleBuildPanel/ModuleBuildPanel';
import {
  MovementCard,
  TrainingCard,
  TrainingStatusCard,
  WayfinderCard,
} from '../components/organisms/PathfinderCards/PathfinderCards';
import { RadioContacts } from '../components/organisms/RadioContacts/RadioContacts';
import { RelayCard, WorkshopCard, WorkshopStatusCard } from '../components/organisms/RelayCards/RelayCards';
import { RoadCard } from '../components/organisms/RoadCard/RoadCard';
import { FarSignalsCard, SignalScanCard } from '../components/organisms/SignalCards/SignalCards';
import { SurveyCard, SurveyTentCard, SurveyTentStatusCard } from '../components/organisms/SurveyCards/SurveyCards';
import type { GameController } from '../hooks/useGame';
import { LOADED_MODULES } from '../moduleRegistry';

/**
 * The cards of the right-hand stack, in their fixed order. Each card appears only when the
 * selection (or chapter progress) offers it; most of the time none or one is visible.
 */
export function GameBuildStack({ game }: { readonly game: GameController }) {
  const { gameState, selectedTile, selection, actions, online, cancelSelection } = game;
  const {
    selectedBuilding, pathfinder, surveyTent, workshop, isVillageSelected, isRelaySelected,
    trainingPreview, surveyTentPreview, workshopPreview, relayRepairPreview, surveyPreview,
    roadPreview, movementPreview, buildingPlan, commandNowMs,
  } = selection;
  const farSignals = gameState?.signals ?? [];
  const maxCharges = game.maxPathfinderCharges;

  return (
    <>
      {game.chapterSixComplete && !game.chapterSevenComplete && (
        <SignalScanCard onScan={actions.confirmSignalScan} />
      )}

      {game.signalNetworkActive && game.radioContacts.length > 0 && (
        <RadioContacts contacts={game.radioContacts} />
      )}

      {game.signalNetworkActive && gameState !== null && online?.market !== undefined && (
        <MarketPanel market={online.market} state={gameState} onChange={game.changeGameState} />
      )}

      {game.signalNetworkActive && farSignals.length > 0 && <FarSignalsCard signals={farSignals} />}

      {isRelaySelected && gameState !== null && (
        <RelayCard
          relay={gameState.relay}
          signalwerkSolved={selection.signalwerkSolved}
          workshopActive={workshop?.status === 'active'}
          coreCount={gameState.inventory.resonanceCore}
          repairPreview={relayRepairPreview}
          nowMs={commandNowMs}
          onClose={cancelSelection}
          onRepair={actions.confirmRelayRepair}
          onOpenSignalwerk={game.openSignalwerk}
        />
      )}

      {trainingPreview !== null && (
        <TrainingCard preview={trainingPreview} onCancel={cancelSelection} onConfirm={actions.confirmTraining} />
      )}

      {isVillageSelected && pathfinder?.status === 'training' && (
        <TrainingStatusCard pathfinder={pathfinder} nowMs={commandNowMs} onClose={cancelSelection} />
      )}

      {surveyTentPreview !== null && (
        <SurveyTentCard preview={surveyTentPreview} onCancel={cancelSelection} onConfirm={actions.confirmSurveyTent} />
      )}

      {isVillageSelected && surveyTent !== undefined && movementPreview === null && workshopPreview === null && workshop === undefined && (
        <SurveyTentStatusCard tent={surveyTent} nowMs={commandNowMs} onClose={cancelSelection} />
      )}

      {workshopPreview !== null && (
        <WorkshopCard preview={workshopPreview} onCancel={cancelSelection} onConfirm={actions.confirmWorkshop} />
      )}

      {isVillageSelected && workshop !== undefined && (
        <WorkshopStatusCard workshop={workshop} nowMs={commandNowMs} onClose={cancelSelection} />
      )}

      {surveyPreview !== null && selectedTile !== null && (
        <SurveyCard
          coord={selectedTile.coord}
          preview={surveyPreview}
          charges={pathfinder?.charges ?? 0}
          maxCharges={maxCharges}
          onCancel={cancelSelection}
          onConfirm={actions.confirmSurvey}
        />
      )}

      {movementPreview !== null && selectedTile !== null && (
        <MovementCard
          coord={selectedTile.coord}
          preview={movementPreview}
          charges={pathfinder?.charges ?? 0}
          maxCharges={maxCharges}
          onCancel={cancelSelection}
          onConfirm={actions.confirmMovement}
        />
      )}

      {pathfinder?.status === 'active' && selectedTile?.key === pathfinder.tileKey && !isVillageSelected && selectedBuilding === undefined && buildingPlan === null && (
        <WayfinderCard
          pathfinder={pathfinder}
          maxCharges={maxCharges}
          nowMs={commandNowMs}
          guidance={game.guidance}
          onClose={cancelSelection}
        />
      )}

      {selectedBuilding !== undefined && (
        <BuildingStatusCard building={selectedBuilding} nowMs={commandNowMs} modules={LOADED_MODULES} onClose={cancelSelection} />
      )}

      {selectedBuilding === undefined && buildingPlan !== null && (
        <BuildingPlanCard plan={buildingPlan} onCancel={cancelSelection} onConfirm={actions.confirmBuilding} />
      )}

      {selectedBuilding === undefined && gameState !== null && selectedTile !== null && (
        <ModuleBuildPanel
          state={gameState}
          coord={selectedTile.coord}
          nowMs={commandNowMs}
          modules={LOADED_MODULES}
          onBuild={actions.confirmModuleBuilding}
          onCancel={cancelSelection}
        />
      )}

      {selectedBuilding === undefined && buildingPlan === null && movementPreview === null && selectedTile !== null && roadPreview !== null && (
        <RoadCard
          coord={selectedTile.coord}
          preview={roadPreview}
          newlyRevealedCount={selection.newlyRevealedCount}
          onCancel={cancelSelection}
          onConfirm={actions.confirmRoad}
        />
      )}
    </>
  );
}
