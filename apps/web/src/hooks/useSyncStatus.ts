import { useCallback, useEffect, useState } from 'react';
import type { OnlineSession, SyncStatus } from '../online';

/** Online save status, the session's start notice and the "load newer save" action. */
export function useSyncStatus(online: OnlineSession | undefined, setSystemNotice: (notice: string) => void) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(online?.sync.getStatus() ?? null);
  useEffect(() => {
    if (online === undefined) return undefined;
    setSyncStatus(online.sync.getStatus());
    return online.sync.subscribe(setSyncStatus);
  }, [online]);
  useEffect(() => {
    if (online?.notice) setSystemNotice(online.notice);
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps -- setter is stable
  const loadNewerOnlineSave = useCallback(() => {
    if (online === undefined) return;
    void online.sync.adoptServer().then((adopted) => {
      if (adopted) window.location.reload();
      else setSystemNotice('Der Online-Spielstand konnte gerade nicht geladen werden. Bitte später erneut versuchen.');
    });
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps -- setter is stable
  return { syncStatus, loadNewerOnlineSave };
}
