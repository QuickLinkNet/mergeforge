import { WORLD_PULSE_MS, type GameState } from '@mergeforge/domain';
import { clampedProgress } from '../../../game/clock';
import { formatRemaining } from '../../../game/copy';
import { lumberFailureCopy, quarryFailureCopy } from '../../../game/failureCopy';
import { describeBuilding, type BuildingPlan, type ProductionBuilding } from '../../../game/buildings';
import type { LoadedModule } from '../../../moduleRegistry';
import { Button } from '../../atoms/Button/Button';
import { ProgressBar } from '../../atoms/ProgressBar/ProgressBar';
import { Symbol } from '../../atoms/Symbol/Symbol';
import { BuildPreview } from '../../molecules/BuildPreview/BuildPreview';
import { BuildTimer } from '../../molecules/BuildTimer/BuildTimer';
import { BuildActions, BuildCard, BuildExplanation, BuildWarning } from '../BuildCard/BuildCard';

export interface BuildingPlanCardProps {
  readonly plan: BuildingPlan;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Plan a lumber camp or quarry on the selected field. */
export function BuildingPlanCard({ plan, onCancel, onConfirm }: BuildingPlanCardProps) {
  return (
    <BuildCard
      titleId="build-title"
      icon={<Symbol glyph={plan.icon} variant={plan.type === 'quarry' ? 'quarry' : 'camp'} />}
      kicker="Gebäude planen"
      title={plan.name}
    >
      {plan.result.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: `${plan.woodCost} Holz · ${plan.stoneCost} Stein` },
            { label: 'Bauzeit', value: '10:00' },
            { label: 'Ertrag', value: plan.output },
          ]} />
          <BuildExplanation>Nur ein Gebäude kann gleichzeitig im Bau sein.</BuildExplanation>
        </>
      ) : (
        <BuildWarning>
          {plan.type === 'quarry'
            ? quarryFailureCopy[plan.result.reason]
            : lumberFailureCopy[plan.result.reason]}
        </BuildWarning>
      )}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!plan.result.ok} onClick={onConfirm}>{plan.action}</Button>
      </BuildActions>
    </BuildCard>
  );
}

export interface BuildingStatusCardProps {
  readonly building: ProductionBuilding;
  readonly nowMs: number;
  readonly modules: readonly LoadedModule[];
  /** The game state, so the yield includes finished production upgrades. */
  readonly state?: GameState;
  readonly onClose: () => void;
}

/** Construction progress or production timer of the selected building. */
export function BuildingStatusCard({ building, nowMs, modules, state, onClose }: BuildingStatusCardProps) {
  const { name, article, resource, yieldPerPulse } = describeBuilding(building, modules, state);
  const constructing = building.status === 'constructing';
  const remainingMs = constructing
    ? building.completesAtMs - nowMs
    : building.lastProductionAtMs + WORLD_PULSE_MS - nowMs;
  const progress = constructing
    ? clampedProgress(nowMs - building.startedAtMs, building.completesAtMs - building.startedAtMs)
    : 1;
  return (
    <BuildCard
      className="building-status-card"
      titleId="building-title"
      icon={(
        <Symbol
          glyph={building.type === 'quarry' ? '◆' : building.type === 'module' ? '✦' : '♜'}
          variant={building.type === 'quarry' ? 'quarry' : 'camp'}
        />
      )}
      kicker={name}
      title={constructing ? 'Bau läuft' : 'Produktion aktiv'}
    >
      <ProgressBar label="Baufortschritt" value={progress} />
      <BuildTimer
        label={constructing ? 'Fertig in' : `Nächste +${yieldPerPulse} ${resource} in`}
        value={formatRemaining(remainingMs)}
      />
      <BuildExplanation>
        {constructing
          ? `Am Bauende wird ${article}${name} aktiv und liefert sofort ${yieldPerPulse} ${resource}.`
          : `${name} produziert automatisch ${yieldPerPulse} ${resource} je 10-Minuten-Welttakt.`}
      </BuildExplanation>
      <BuildActions single><Button variant="secondary" onClick={onClose}>Schließen</Button></BuildActions>
    </BuildCard>
  );
}
