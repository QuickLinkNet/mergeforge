import { useMemo } from 'react';
import type { GameState } from '@mergeforge/domain';
import { createSignalwerkPuzzle, tileConnections } from '@mergeforge/signalwerk';
import { directionCopy } from '../../../game/copy';
import { Button } from '../../atoms/Button/Button';
import { IconButton } from '../../atoms/IconButton/IconButton';
import './SignalwerkDialog.css';

export interface SignalwerkDialogProps {
  readonly state: GameState;
  readonly onRotate: (index: number) => void;
  readonly onClose: () => void;
}

/** The 5×5 rune puzzle in the relay. Progress lives in the game state, so closing keeps it. */
export function SignalwerkDialog({ state, onRotate, onClose }: SignalwerkDialogProps) {
  const puzzle = useMemo(() => createSignalwerkPuzzle(state.signalwerk.seed), [state.signalwerk.seed]);
  const solved = state.signalwerk.solved;
  return (
    <section className="signalwerk-backdrop" role="dialog" aria-modal="true" aria-labelledby="signalwerk-title">
      <div className="signalwerk-panel">
        <header className="signalwerk-header">
          <div>
            <span className="signalwerk-kicker">Relaismodul · 5×5</span>
            <h2 id="signalwerk-title">Signalwerk</h2>
            <p>{solved ? 'Energiefluss stabil. Der einzigartige Kern wurde geborgen.' : 'Jede Platte dreht sich um 90°. Verbindet die blaue Quelle links mit dem goldenen Ziel rechts.'}</p>
          </div>
          <IconButton className="signalwerk-close" label="Signalwerk schließen" onClick={onClose} />
        </header>

        <div className={`signalwerk-stage ${solved ? 'solved' : ''}`}>
          <span className="signal-terminal source-terminal" aria-hidden="true"><i />Quelle</span>
          <div className="signalwerk-grid" role="grid" aria-label="Signalwerk Runenraster">
            {puzzle.tiles.map((tile, index) => {
              const rotation = state.signalwerk.rotations[index] ?? 0;
              const connections = tileConnections(tile, rotation);
              const isSource = index === puzzle.sourceIndex;
              const isTarget = index === puzzle.targetIndex;
              const connectionLabel = connections.map((direction) => directionCopy[direction]).join(', ');
              return (
                <button
                  className={`signal-rune ${isSource ? 'source-rune' : ''} ${isTarget ? 'target-rune' : ''}`}
                  key={index}
                  type="button"
                  role="gridcell"
                  aria-label={`Rune ${index + 1}${isSource ? ', Quelle' : ''}${isTarget ? ', Ziel' : ''}, ${rotation * 90} Grad, offen nach ${connectionLabel}`}
                  disabled={solved}
                  onClick={() => onRotate(index)}
                >
                  <span className="rune-lines" aria-hidden="true">
                    {connections.map((direction) => <i className={`rune-line ${direction}`} key={direction} />)}
                    <b />
                  </span>
                </button>
              );
            })}
          </div>
          <span className="signal-terminal target-terminal" aria-hidden="true">Ziel<i /></span>
        </div>

        <footer className="signalwerk-footer">
          {solved ? (
            <div className="core-result" role="status">
              <span className="core-glyph" aria-hidden="true">◈</span>
              <span><small>{state.relay.coreInstalled ? 'Relais' : 'Inventar'}</small><strong>{state.relay.coreInstalled ? 'Resonanzkern · installiert' : '1 Resonanzkern · bereit'}</strong></span>
            </div>
          ) : (
            <p>Fortschritt wird nach jeder Drehung automatisch gespeichert. Schließen setzt das Raster nicht zurück.</p>
          )}
          <Button variant="secondary" className="signalwerk-done" onClick={onClose}>Zurück zur Karte</Button>
        </footer>
      </div>
    </section>
  );
}
