import {
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  SURVEY_TENT_STONE_COST,
  SURVEY_TENT_WOOD_COST,
  type HexCoord,
  type StartSurveyTentResult,
  type SurveyTent,
  type SurveyWithPathfinderResult,
} from '@mergeforge/domain';
import { clampedProgress } from '../../../game/clock';
import { formatRemaining } from '../../../game/copy';
import { surveyFailureCopy, surveyTentFailureCopy } from '../../../game/failureCopy';
import { Button } from '../../atoms/Button/Button';
import { ProgressBar } from '../../atoms/ProgressBar/ProgressBar';
import { Symbol } from '../../atoms/Symbol/Symbol';
import { BuildPreview } from '../../molecules/BuildPreview/BuildPreview';
import { BuildTimer } from '../../molecules/BuildTimer/BuildTimer';
import { BuildActions, BuildCard, BuildExplanation, BuildWarning } from '../BuildCard/BuildCard';

const tentIcon = <Symbol glyph="△" variant="tent" />;

export interface SurveyCardProps {
  readonly coord: HexCoord;
  readonly preview: SurveyWithPathfinderResult;
  readonly charges: number;
  readonly maxCharges: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Survey one fogged hex with a pathfinder charge. */
export function SurveyCard({ coord, preview, charges, maxCharges, onCancel, onConfirm }: SurveyCardProps) {
  return (
    <BuildCard
      className="exploration-card"
      titleId="survey-title"
      icon={<Symbol glyph="⌖" variant="survey" />}
      kicker="Nebel untersuchen"
      title={<>Hex {coord.q}, {coord.r} vermessen</>}
    >
      {preview.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: '1 Ladung' },
            { label: 'Aufdeckung', value: 'genau 1 Hex' },
            { label: 'Verbleibend', value: <>{Math.max(0, charges - 1)} / {maxCharges}</> },
          ]} />
          <BuildExplanation>Vermessung schafft Sicht, aber weder Besitz noch eine Straßenverbindung.</BuildExplanation>
        </>
      ) : <BuildWarning>{surveyFailureCopy[preview.reason]}</BuildWarning>}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!preview.ok} onClick={onConfirm}>Jetzt vermessen</Button>
      </BuildActions>
    </BuildCard>
  );
}

export interface SurveyTentCardProps {
  readonly preview: StartSurveyTentResult;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Build the survey tent at the village. */
export function SurveyTentCard({ preview, onCancel, onConfirm }: SurveyTentCardProps) {
  return (
    <BuildCard className="exploration-card" titleId="tent-title" icon={tentIcon} kicker="Dorfausbau" title="Vermesserzelt">
      {preview.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: `${SURVEY_TENT_WOOD_COST} Holz · ${SURVEY_TENT_STONE_COST} Stein` },
            { label: 'Bauzeit', value: '10:00' },
            { label: 'Ladungen', value: `${PATHFINDER_BASE_MAX_CHARGES} → ${PATHFINDER_EXPANDED_MAX_CHARGES}` },
          ]} />
          <BuildExplanation>Das Zelt verdoppelt den Speicher für Expeditionsladungen dauerhaft.</BuildExplanation>
        </>
      ) : <BuildWarning>{surveyTentFailureCopy[preview.reason]}</BuildWarning>}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!preview.ok} onClick={onConfirm}>Zelt errichten</Button>
      </BuildActions>
    </BuildCard>
  );
}

export interface SurveyTentStatusCardProps {
  readonly tent: SurveyTent;
  readonly nowMs: number;
  readonly onClose: () => void;
}

/** Survey tent under construction or active. */
export function SurveyTentStatusCard({ tent, nowMs, onClose }: SurveyTentStatusCardProps) {
  const constructing = tent.status === 'constructing';
  const remainingMs = constructing ? tent.completesAtMs - nowMs : 0;
  const progress = constructing
    ? clampedProgress(nowMs - tent.startedAtMs, tent.completesAtMs - tent.startedAtMs)
    : 1;
  return (
    <BuildCard
      className="building-status-card exploration-card"
      titleId="tent-status-title"
      icon={tentIcon}
      kicker="Vermesserzelt"
      title={constructing ? 'Bau läuft' : 'Expeditionslager aktiv'}
    >
      <ProgressBar label="Zeltfortschritt" value={progress} />
      <BuildTimer
        label={constructing ? 'Fertig in' : 'Ladungsspeicher'}
        value={constructing ? formatRemaining(remainingMs) : `${PATHFINDER_EXPANDED_MAX_CHARGES} max.`}
      />
      <BuildExplanation>{constructing ? 'Nach Abschluss steigt das Ladungsmaximum von 6 auf 12.' : 'Der Wegfinder kann bis zu 12 Vermessungsaktionen speichern.'}</BuildExplanation>
      <BuildActions single><Button variant="secondary" onClick={onClose}>Schließen</Button></BuildActions>
    </BuildCard>
  );
}
