import type { GameState } from '@mergeforge/domain';
import { formatRemaining } from '../../../game/copy';
import {
  previewSink,
  sinkCost,
  sinkEffect,
  sinkFailureCopy,
  sinkTitle,
  type SinkId,
} from '../../../game/sinks';
import { Button } from '../../atoms/Button/Button';
import { Symbol, type SymbolVariant } from '../../atoms/Symbol/Symbol';
import { BuildPreview } from '../../molecules/BuildPreview/BuildPreview';
import { BuildActions, BuildCard, BuildExplanation, BuildWarning } from '../BuildCard/BuildCard';

const ICONS: Readonly<Record<SinkId, { readonly glyph: string; readonly variant: SymbolVariant }>> = {
  storehouse: { glyph: '▣', variant: 'workshop' },
  'lumber-upgrade': { glyph: '♜', variant: 'camp' },
  'quarry-upgrade': { glyph: '◆', variant: 'quarry' },
};

const EXPLANATIONS: Readonly<Record<SinkId, string>> = {
  storehouse: 'Das Lagerhaus steht im Dorf. Der größere Speicher gilt erst, wenn der Bau fertig ist.',
  'lumber-upgrade': 'Der Ausbau gilt für jedes Holzfällerlager, ab dem ersten Takt nach Bauende.',
  'quarry-upgrade': 'Der Ausbau gilt für jeden Steinbruch, ab dem ersten Takt nach Bauende.',
};

export interface SinkBuildCardProps {
  readonly sink: SinkId;
  readonly state: GameState;
  readonly nowMs: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Confirmation card for the storehouse and the production upgrades (village, uses the build slot). */
export function SinkBuildCard({ sink, state, nowMs, onCancel, onConfirm }: SinkBuildCardProps) {
  const preview = previewSink(sink, state, nowMs);
  const cost = sinkCost(sink, state);
  const icon = ICONS[sink];
  return (
    <BuildCard
      className="exploration-card sink-card"
      titleId="sink-title"
      icon={<Symbol glyph={icon.glyph} variant={icon.variant} />}
      kicker="Dorfausbau"
      title={sinkTitle(sink, state)}
    >
      {preview.ok ? (
        <>
          <BuildPreview items={[
            { label: 'Kosten', value: `${cost.wood} Holz · ${cost.stone} Stein` },
            { label: 'Bauzeit', value: formatRemaining(cost.buildMs) },
            { label: 'Wirkung', value: sinkEffect(sink, state) },
          ]} />
          <BuildExplanation>{EXPLANATIONS[sink]} Nur ein Auftrag kann gleichzeitig laufen.</BuildExplanation>
        </>
      ) : <BuildWarning>{sinkFailureCopy(sink, preview.reason)}</BuildWarning>}
      <BuildActions>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={!preview.ok} onClick={onConfirm}>
          {sink === 'storehouse' ? 'Lagerhaus bauen' : 'Ausbau starten'}
        </Button>
      </BuildActions>
    </BuildCard>
  );
}
