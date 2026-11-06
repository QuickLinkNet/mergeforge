import { Toast } from '../components/atoms/Toast/Toast';
import { IconButton } from '../components/atoms/IconButton/IconButton';
import { Banner } from '../components/molecules/Banner/Banner';
import { AccountBadge } from '../components/organisms/AccountBadge/AccountBadge';
import { BuildMenu, BuildMenuToggle } from '../components/organisms/BuildMenu/BuildMenu';
import { CameraHints } from '../components/organisms/CameraHints/CameraHints';
import { MissionPanel } from '../components/organisms/MissionPanel/MissionPanel';
import { SignalwerkDialog } from '../components/organisms/SignalwerkDialog/SignalwerkDialog';
import { TopBar } from '../components/organisms/TopBar/TopBar';
import { ViewMessage } from '../components/organisms/ViewMessage/ViewMessage';
import { WorldBadge } from '../components/organisms/WorldBadge/WorldBadge';
import { GameLayout } from '../components/templates/GameLayout/GameLayout';
import { syncLabel } from '../game/copy';
import { MODULE_MANIFESTS } from '../game/modules';
import type { GameController } from '../hooks/useGame';
import { GameBuildStack } from './GameBuildStack';

/** The playing screen: map, HUD, build stack, menu and messages for one game session. */
export function GamePage({ game }: { readonly game: GameController }) {
  const { gameState, online, bootstrap, mission, selection, renderer } = game;
  const pathfinder = selection.pathfinder;
  const coreKnown = gameState?.inventory.resonanceCore === 1 || gameState?.relay.coreInstalled;

  return (
    <GameLayout
      halted={!bootstrap.ok}
      mapHostRef={renderer.mapHostRef}
      mapBusy={renderer.viewState === 'loading'}
      account={<AccountBadge />}
      topBar={(
        <TopBar
          syncLabel={syncLabel(game.syncStatus)}
          wood={gameState?.resources.wood ?? 0}
          stone={gameState?.resources.stone ?? 0}
          limits={game.storageLimits ?? undefined}
          charges={pathfinder === undefined ? undefined : { current: pathfinder.charges, max: game.maxPathfinderCharges }}
          core={coreKnown ? { installed: gameState?.relay.coreInstalled === true } : undefined}
          chapterNumber={mission.chapterNumber}
          chapterName={mission.chapterName}
          chapterComplete={mission.complete}
        />
      )}
      mission={<MissionPanel mission={mission} guidance={game.guidance} onHighlight={game.highlightFields} />}
      buildStack={<GameBuildStack game={game} />}
      buildMenu={gameState !== null && (
        <>
          {game.buildMenuOpen && (
            <BuildMenu
              state={gameState}
              nowMs={selection.commandNowMs}
              catalog={game.catalog}
              modules={MODULE_MANIFESTS}
              onClose={game.closeBuildMenu}
              onAction={game.actions.handleMenuAction}
              tradeAvailable={online?.market !== undefined}
              {...(online === undefined || online.isOwner === true ? { onSkipTime: game.actions.skipOnePulse } : {})}
            />
          )}
          <BuildMenuToggle open={game.buildMenuOpen} onToggle={game.toggleBuildMenu} />
        </>
      )}
      messages={(
        <>
          {game.syncStatus === 'conflict' && (
            <Banner
              variant="system"
              role="alert"
              message="Dein Online-Spielstand wurde in einem anderen Browser weitergespielt. Dieser Browser speichert nicht mehr, bis du den neueren Stand lädst."
            >
              <button type="button" onClick={game.loadNewerOnlineSave}>Neueren Stand laden</button>
            </Banner>
          )}
          {game.systemNotice !== null && (
            <Banner variant="system" role="status" message={game.systemNotice}>
              <IconButton label="Hinweis schließen" onClick={game.dismissSystemNotice} />
            </Banner>
          )}
          {game.eventMessage !== null && <Toast message={game.eventMessage} />}
          {game.chapterBanner !== null && (
            <Banner variant="chapter" role="status" message={game.chapterBanner}>
              <IconButton label="Meldung schließen" onClick={game.dismissChapterBanner} />
            </Banner>
          )}
        </>
      )}
      dialog={game.signalwerkOpen && gameState !== null && (
        <SignalwerkDialog state={gameState} onRotate={game.actions.rotateRune} onClose={game.closeSignalwerk} />
      )}
      worldInfo={(
        <>
          <WorldBadge
            sectorLabel={online === undefined ? 'Genesis-Sektor' : `Sektor ${online.player.sector.q}|${online.player.sector.r}`}
            worldSeed={game.worldSeed}
            generatorVersion={gameState?.world.generatorVersion ?? 'unbekannt'}
          />
          <CameraHints />
        </>
      )}
      viewMessage={renderer.viewState !== 'ready' && (
        <ViewMessage
          state={renderer.viewState}
          bootstrapOk={bootstrap.ok}
          blocked={!bootstrap.ok && bootstrap.blocked === true}
          errorMessage={renderer.errorMessage}
        />
      )}
    />
  );
}
