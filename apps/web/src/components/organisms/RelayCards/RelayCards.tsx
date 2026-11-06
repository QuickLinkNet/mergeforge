import {
  RELAY_REPAIR_MS,
  WORKSHOP_BUILD_MS,
  WORKSHOP_STONE_COST,
  WORKSHOP_WOOD_COST,
  type RelayState,
  type StartRelayRepairResult,
  type StartWorkshopResult,
  type Workshop,
} from '@mergeforge/domain';
import { clampedProgress } from '../../../game/clock';
import { formatRemaining } from '../../../game/copy';
import { relayRepairFailureCopy, workshopFailureCopy } from '../../../game/failureCopy';
import { Button } from '../../atoms/Button/Button';
import { ProgressBar } from '../../atoms/ProgressBar/ProgressBar';
import { Symbol } from '../../atoms/Symbol/Symbol';
import { BuildPreview } from '../../molecules/BuildPreview/BuildPreview';
import { BuildTimer } from '../../molecules/BuildTimer/BuildTimer';
import { BuildActions, BuildCard, BuildExplanation, BuildWarning } from '../BuildCard/BuildCard';

const workshopIcon = <Symbol glyph="⚒" variant="workshop" />;

export interface RelayCardProps {
  readonly relay: RelayState;
  readonly signalwerkSolved: boolean;
  readonly workshopActive: boolean;
  readonly coreCount: number;
  readonly repairPreview: StartRelayRepairResult | null;
  readonly nowMs: number;
  readonly onClose: () => void;
  readonly onRepair: () => void;
  readonly onOpenSignalwerk: () => void;
}

/** The discovered relay: Signalwerk, core installation and repair. */
export function RelayCard(props: RelayCardProps) {
  const { relay, signalwerkSolved, workshopActive, coreCount, repairPreview, nowMs } = props;
  const relayStatus = relay.status;
  const remainingMs = relay.status === 'repairing' ? relay.completesAtMs - nowMs : 0;
  const repairProgress = relay.status === 'repairing'
    ? clampedProgress(nowMs - relay.startedAtMs, RELAY_REPAIR_MS)
    : relay.status === 'active' ? 1 : 0;
  return (
    <BuildCard
      className="relay-card"
      titleId="relay-title"
      icon={<Symbol glyph="◉" variant="relay" />}
      kicker="Signalrelais"
      title={relayStatus === 'active' ? 'Relais wiederhergestellt' : relayStatus === 'repairing' ? 'Reparatur läuft' : signalwerkSolved ? 'Kern bereit' : 'Signalwerk zugänglich'}
    >
      <BuildPreview items={[
        { label: 'Signalwerk', value: signalwerkSolved ? 'Gelöst' : 'Unterbrochen' },
        { label: 'Werkstatt', value: workshopActive ? 'Aktiv' : 'Benötigt' },
        { label: 'Kern', value: relay.coreInstalled ? 'Installiert' : `${coreCount} / 1` },
      ]} />
      {relayStatus === 'repairing' && (
        <>
          <ProgressBar label="Relaisreparatur" value={repairProgress} />
          <BuildTimer label="Signal bereit in" value={formatRemaining(remainingMs)} />
        </>
      )}
      <BuildExplanation>
        {relayStatus === 'active'
          ? 'Der Resonanzkern bleibt sichtbar im Relais und versorgt den Mast dauerhaft.'
          : relayStatus === 'repairing'
            ? 'Der Kern ist eingesetzt. Die Werkstatt stellt die alten Signalpfade wieder her.'
            : signalwerkSolved
              ? repairPreview?.ok === false
                ? relayRepairFailureCopy[repairPreview.reason]
                : 'Installiert den Kern und startet die einmalige Reparatur.'
              : 'Dreht die Runenplatten, bis blaue Quelle und goldenes Ziel verbunden sind.'}
      </BuildExplanation>
      <BuildActions>
        <Button variant="secondary" onClick={props.onClose}>Schließen</Button>
        {relayStatus === 'dormant' && (signalwerkSolved
          ? <Button variant="primary" disabled={repairPreview?.ok !== true} onClick={props.onRepair}>Kern installieren · Reparatur starten</Button>
          : <Button variant="primary" onClick={props.onOpenSignalwerk}>Signalwerk öffnen</Button>)}
      </BuildActions>
    </BuildCard>
  );
}

export interface WorkshopCardProps {
  readonly preview: StartWorkshopResult;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Build the relay workshop at the village. */
export function WorkshopCard({ preview, onCancel, onConfirm }: WorkshopCardProps) {
  return (
    <BuildCard className="exploration-card workshop-card" titleId="workshop-title" icon={workshopIcon} kicker="Dorfausbau" title="Relaiswerkstatt">
      {preview.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: `${WORKSHOP_WOOD_COST} Holz · ${WORKSHOP_STONE_COST} Stein` },
            { label: 'Bauzeit', value: '20:00' },
            { label: 'Funktion', value: 'Relais reparieren' },
          ]} />
          <BuildExplanation>Die Werkstatt ist der einzige Ort, an dem der Resonanzkern sicher in das alte Relais eingesetzt werden kann.</BuildExplanation>
        </>
      ) : <BuildWarning>{workshopFailureCopy[preview.reason]}</BuildWarning>}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!preview.ok} onClick={onConfirm}>Werkstatt errichten</Button>
      </BuildActions>
    </BuildCard>
  );
}

export interface WorkshopStatusCardProps {
  readonly workshop: Workshop;
  readonly nowMs: number;
  readonly onClose: () => void;
}

/** Workshop under construction or ready for the core. */
export function WorkshopStatusCard({ workshop, nowMs, onClose }: WorkshopStatusCardProps) {
  const constructing = workshop.status === 'constructing';
  const remainingMs = constructing ? workshop.completesAtMs - nowMs : 0;
  const progress = constructing ? clampedProgress(nowMs - workshop.startedAtMs, WORKSHOP_BUILD_MS) : 1;
  return (
    <BuildCard
      className="building-status-card exploration-card workshop-card"
      titleId="workshop-status-title"
      icon={workshopIcon}
      kicker="Relaiswerkstatt"
      title={constructing ? 'Bau läuft' : 'Werkstatt aktiv'}
    >
      <ProgressBar label="Werkstattfortschritt" value={progress} />
      <BuildTimer label={constructing ? 'Fertig in' : 'Status'} value={constructing ? formatRemaining(remainingMs) : 'Bereit'} />
      <BuildExplanation>{constructing ? 'Nach Abschluss kann der Kern am entdeckten Relais installiert werden.' : 'Wählt das Relais, um den Resonanzkern zu installieren und die Reparatur zu starten.'}</BuildExplanation>
      <BuildActions single><Button variant="secondary" onClick={onClose}>Schließen</Button></BuildActions>
    </BuildCard>
  );
}
