import type { ReactNode, RefObject } from 'react';
import './GameLayout.css';

export interface GameLayoutProps {
  /** A blocked or failed start hides the HUD and shows only the message. */
  readonly halted: boolean;
  readonly mapHostRef: RefObject<HTMLDivElement | null>;
  readonly mapBusy: boolean;
  readonly account: ReactNode;
  readonly topBar: ReactNode;
  readonly mission: ReactNode;
  /** Cards in the right-hand stack; the stack hides itself when empty. */
  readonly buildStack: ReactNode;
  readonly buildMenu: ReactNode;
  /** Notices, toast and chapter banner. */
  readonly messages: ReactNode;
  readonly dialog: ReactNode;
  readonly worldInfo: ReactNode;
  readonly viewMessage: ReactNode;
}

/** Full-screen map with the HUD layers stacked on top, in a fixed DOM order. */
export function GameLayout(props: GameLayoutProps) {
  return (
    <main className={props.halted ? 'game-shell is-halted' : 'game-shell'} aria-label="MERGEFORGE Weltansicht">
      <div
        ref={props.mapHostRef}
        className="map-host"
        role="img"
        aria-label="Isometrische Hexwelt rund um das Dorf Genesis"
        aria-busy={props.mapBusy}
      />
      <div className="map-atmosphere" aria-hidden="true" />
      {props.account}
      {props.topBar}
      {props.mission}
      <div className="build-stack">
        {props.buildStack}
      </div>
      {props.buildMenu}
      {props.messages}
      {props.dialog}
      {props.worldInfo}
      {props.viewMessage}
    </main>
  );
}
