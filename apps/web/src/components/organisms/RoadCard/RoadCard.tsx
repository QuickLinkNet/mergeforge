import { ROAD_WOOD_COST, type BuildRoadResult, type HexCoord } from '@mergeforge/domain';
import { roadFailureCopy } from '../../../game/failureCopy';
import { Button } from '../../atoms/Button/Button';
import { ResourceDot } from '../../atoms/ResourceDot/ResourceDot';
import { Symbol } from '../../atoms/Symbol/Symbol';
import { BuildPreview } from '../../molecules/BuildPreview/BuildPreview';
import { BuildActions, BuildCard, BuildExplanation, BuildWarning } from '../BuildCard/BuildCard';

export interface RoadCardProps {
  readonly coord: HexCoord;
  readonly preview: BuildRoadResult;
  readonly newlyRevealedCount: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Plan a road on the selected field. */
export function RoadCard({ coord, preview, newlyRevealedCount, onCancel, onConfirm }: RoadCardProps) {
  return (
    <BuildCard
      titleId="build-title"
      icon={<Symbol glyph="⌁" />}
      kicker="Straße planen"
      title={<>Weg nach {coord.q}, {coord.r}</>}
    >
      {preview.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: <><ResourceDot kind="wood" /> {ROAD_WOOD_COST} Holz</> },
            { label: 'Aufdeckung', value: <>{newlyRevealedCount} {newlyRevealedCount === 1 ? 'neues Feld' : 'neue Felder'}</> },
            { label: 'Bauzeit', value: 'Sofort' },
          ]} />
          <BuildExplanation>Oberflächenfunde auf neu entdeckten Feldern werden direkt eingelagert.</BuildExplanation>
        </>
      ) : <BuildWarning>{roadFailureCopy[preview.reason]}</BuildWarning>}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!preview.ok} onClick={onConfirm}>Straße bauen</Button>
      </BuildActions>
    </BuildCard>
  );
}
