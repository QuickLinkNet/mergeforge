import { describeDistanceBand, type GameState } from '@mergeforge/domain';
import { signalBearingCopy } from '../../../game/copy';
import { Button } from '../../atoms/Button/Button';
import { Symbol } from '../../atoms/Symbol/Symbol';
import { SignalList } from '../../molecules/SignalList/SignalList';
import { BuildActions, BuildCard, BuildExplanation } from '../BuildCard/BuildCard';

/** Chapter 7: listen for far settlements once the relay works again. */
export function SignalScanCard({ onScan }: { readonly onScan: () => void }) {
  return (
    <BuildCard
      className="signal-card"
      titleId="signal-scan-title"
      icon={<Symbol glyph="≋" variant="relay" />}
      kicker="Relais aktiv"
      title="Fernsignal scannen"
    >
      <BuildExplanation>Das Relais lauscht nach anderen Siedlungen. Der Scan kostet nichts; gezeigt werden nur grobe Richtung und Entfernung.</BuildExplanation>
      <BuildActions>
        <Button variant="primary" onClick={onScan}>Fernsignal scannen</Button>
      </BuildActions>
    </BuildCard>
  );
}

/** Coarse bearing and distance of the received far signals. */
export function FarSignalsCard({ signals }: { readonly signals: GameState['signals'] }) {
  return (
    <BuildCard
      className="signal-card"
      titleId="signals-title"
      icon={<Symbol glyph="≋" variant="relay" />}
      kicker="Signalnetz aktiv"
      title="Fernsignale"
    >
      <SignalList items={signals.map((signal, index) => {
        const bearing = signalBearingCopy[signal.bearing];
        return {
          id: signal.id,
          angle: bearing.angle,
          kicker: `Signal ${index + 1}`,
          title: bearing.label,
          detail: `ca. ${describeDistanceBand(signal.distanceBand)}`,
        };
      })} />
      <BuildExplanation>Nur grobe Richtung und Entfernung. Gelände, Karten und Orte dieser Siedlungen bleiben im Nebel.</BuildExplanation>
    </BuildCard>
  );
}
