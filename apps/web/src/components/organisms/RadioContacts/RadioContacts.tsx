import { contactBandCopy, signalBearingCopy } from '../../../game/copy';
import type { RadioContact } from '../../../online';
import { Symbol } from '../../atoms/Symbol/Symbol';
import { SignalList } from '../../molecules/SignalList/SignalList';
import { BuildCard, BuildExplanation } from '../BuildCard/BuildCard';

/** Real neighbours reached over the signal network: direction and rough distance only. */
export function RadioContacts({ contacts }: { readonly contacts: readonly RadioContact[] }) {
  return (
    <BuildCard
      className="signal-card"
      titleId="contacts-title"
      icon={<Symbol glyph="☍" variant="relay" />}
      kicker="Echte Nachbarn"
      title="Funkkontakte"
    >
      <SignalList items={contacts.map((contact) => {
        const bearing = signalBearingCopy[contact.bearing];
        return {
          id: contact.login,
          angle: bearing.angle,
          kicker: 'Siedlung von',
          title: `${contact.login} · ${bearing.label}`,
          detail: contactBandCopy[contact.distanceBand],
        };
      })} />
      <BuildExplanation>Das sind echte Mitspieler. Du siehst nur Richtung und grobe Entfernung ihres Sektors, keine Karte und keine Orte.</BuildExplanation>
    </BuildCard>
  );
}
