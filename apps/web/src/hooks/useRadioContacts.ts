import { useEffect, useState } from 'react';
import type { OnlineSession, RadioContact } from '../online';

/** Real neighbours, loaded once the signal network is active (online only). */
export function useRadioContacts(signalNetworkActive: boolean, online: OnlineSession | undefined): readonly RadioContact[] {
  const [radioContacts, setRadioContacts] = useState<readonly RadioContact[]>([]);
  useEffect(() => {
    if (!signalNetworkActive || online?.loadContacts === undefined) return undefined;
    let cancelled = false;
    void online.loadContacts().then((contacts) => {
      if (!cancelled) setRadioContacts(contacts);
    });
    return () => {
      cancelled = true;
    };
  }, [signalNetworkActive, online]);
  return radioContacts;
}
