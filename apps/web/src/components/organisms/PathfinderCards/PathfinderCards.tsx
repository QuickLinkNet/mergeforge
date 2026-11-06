import {
  PATHFINDER_STONE_COST,
  PATHFINDER_WOOD_COST,
  type HexCoord,
  type MovePathfinderResult,
  type Pathfinder,
  type StartPathfinderTrainingResult,
} from '@mergeforge/domain';
import { clampedProgress, pathfinderRemainingMs } from '../../../game/clock';
import { formatRemaining } from '../../../game/copy';
import { movementFailureCopy, trainingFailureCopy } from '../../../game/failureCopy';
import type { PathfinderGuidance } from '../../../game/pathfinderGuidance';
import { Button } from '../../atoms/Button/Button';
import { ProgressBar } from '../../atoms/ProgressBar/ProgressBar';
import { Symbol } from '../../atoms/Symbol/Symbol';
import { BuildPreview } from '../../molecules/BuildPreview/BuildPreview';
import { BuildTimer } from '../../molecules/BuildTimer/BuildTimer';
import { BuildActions, BuildCard, BuildExplanation, BuildWarning } from '../BuildCard/BuildCard';

const wayfinderIcon = <Symbol glyph="✦" variant="wayfinder" />;

export interface TrainingCardProps {
  readonly preview: StartPathfinderTrainingResult;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Train the first pathfinder at the village. */
export function TrainingCard({ preview, onCancel, onConfirm }: TrainingCardProps) {
  return (
    <BuildCard className="exploration-card" titleId="training-title" icon={wayfinderIcon} kicker="Einheit ausbilden" title="Wegfinder">
      {preview.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: `${PATHFINDER_WOOD_COST} Holz · ${PATHFINDER_STONE_COST} Stein` },
            { label: 'Ausbildung', value: '10:00' },
            { label: 'Fähigkeit', value: '1 Zielhex' },
          ]} />
          <BuildExplanation>Der Wegfinder bewegt sich kostenlos auf eurem verbundenen Straßennetz.</BuildExplanation>
        </>
      ) : <BuildWarning>{trainingFailureCopy[preview.reason]}</BuildWarning>}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!preview.ok} onClick={onConfirm}>Ausbildung beginnen</Button>
      </BuildActions>
    </BuildCard>
  );
}

export interface TrainingStatusCardProps {
  readonly pathfinder: Pathfinder;
  readonly nowMs: number;
  readonly onClose: () => void;
}

/** Training countdown while the pathfinder is not ready yet. */
export function TrainingStatusCard({ pathfinder, nowMs, onClose }: TrainingStatusCardProps) {
  const progress = pathfinder.status === 'training'
    ? clampedProgress(nowMs - pathfinder.startedAtMs, pathfinder.completesAtMs - pathfinder.startedAtMs)
    : 1;
  return (
    <BuildCard
      className="building-status-card exploration-card"
      titleId="training-status-title"
      icon={wayfinderIcon}
      kicker="Wegfinder"
      title="Ausbildung läuft"
    >
      <ProgressBar label="Ausbildungsfortschritt" value={progress} />
      <BuildTimer label="Bereit in" value={formatRemaining(pathfinderRemainingMs(pathfinder, nowMs))} />
      <BuildExplanation>Nach Abschluss startet der Wegfinder am Dorf und kann sofort Straßenfelder erreichen.</BuildExplanation>
      <BuildActions single><Button variant="secondary" onClick={onClose}>Schließen</Button></BuildActions>
    </BuildCard>
  );
}

export interface MovementCardProps {
  readonly coord: HexCoord;
  readonly preview: MovePathfinderResult;
  readonly charges: number;
  readonly maxCharges: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Move the pathfinder along the road network. */
export function MovementCard({ coord, preview, charges, maxCharges, onCancel, onConfirm }: MovementCardProps) {
  return (
    <BuildCard
      className="exploration-card"
      titleId="movement-title"
      icon={wayfinderIcon}
      kicker="Straßenbewegung"
      title={<>Wegfinder nach {coord.q}, {coord.r}</>}
    >
      {preview.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: 'kostenlos' },
            { label: 'Ankunft', value: 'sofort' },
            { label: 'Ladungen', value: <>{charges} / {maxCharges}</> },
          ]} />
          <BuildExplanation>Bewegung verbraucht keine Expeditionsladung.</BuildExplanation>
        </>
      ) : <BuildWarning>{movementFailureCopy[preview.reason]}</BuildWarning>}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!preview.ok} onClick={onConfirm}>Wegfinder bewegen</Button>
      </BuildActions>
    </BuildCard>
  );
}

export interface WayfinderCardProps {
  readonly pathfinder: Pathfinder;
  readonly maxCharges: number;
  readonly nowMs: number;
  readonly guidance: PathfinderGuidance | null;
  readonly onClose: () => void;
}

/** The selected, ready pathfinder: charges and what to do next. */
export function WayfinderCard({ pathfinder, maxCharges, nowMs, guidance, onClose }: WayfinderCardProps) {
  return (
    <BuildCard
      className="exploration-card"
      titleId="wayfinder-title"
      icon={wayfinderIcon}
      kicker="Einheit bereit"
      title={guidance?.step === 'move' ? 'Wegfinder: nicht am Straßenende' : 'Wegfinder am Straßenkopf'}
    >
      <BuildPreview items={[
        { label: 'Ladungen', value: <>{pathfinder.charges} / {maxCharges}</> },
        { label: 'Vermessung', value: '1 Zielhex' },
        {
          label: 'Nächste Ladung',
          value: pathfinder.charges >= maxCharges ? 'Speicher voll' : formatRemaining(pathfinderRemainingMs(pathfinder, nowMs)),
        },
      ]} />
      <BuildExplanation>{guidance !== null && guidance.step !== 'relay' ? guidance.text : 'Wählt ein einzelnes Nebelhex in Vermessungsreichweite des Straßenkopfs.'}</BuildExplanation>
      <BuildActions single><Button variant="secondary" onClick={onClose}>Schließen</Button></BuildActions>
    </BuildCard>
  );
}
