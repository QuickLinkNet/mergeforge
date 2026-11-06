import type { SignalBearing } from '@mergeforge/domain';
import type { SignalDirection } from '@mergeforge/signalwerk';
import type { RadioContact, SyncStatus } from '../online';

/** Short status line for the save state in the top bar. */
export function syncLabel(status: SyncStatus | null): string {
  switch (status) {
    case 'saving': return 'Speichert online …';
    case 'synced': return 'Online gespeichert';
    case 'offline': return 'Offline · lokal gespeichert';
    case 'conflict': return 'Online-Speicher pausiert';
    default: return 'Automatisch gespeichert';
  }
}

/** Countdown as mm:ss, never negative, rounded up to the next full second. */
export function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secondsPart = (seconds % 60).toString().padStart(2, '0');
  return `${minutesPart}:${secondsPart}`;
}

export const signalBearingCopy: Readonly<Record<SignalBearing, { readonly label: string; readonly angle: number }>> = {
  east: { label: 'Osten', angle: 90 },
  'north-east': { label: 'Nordosten', angle: 30 },
  'north-west': { label: 'Nordwesten', angle: -30 },
  west: { label: 'Westen', angle: -90 },
  'south-west': { label: 'Südwesten', angle: -150 },
  'south-east': { label: 'Südosten', angle: 150 },
};

export const contactBandCopy: Readonly<Record<RadioContact['distanceBand'], string>> = {
  near: 'direkter Nachbarsektor',
  middle: 'zwei Sektoren entfernt',
  far: 'weiter entfernt',
};

export const directionCopy: Readonly<Record<SignalDirection, string>> = {
  north: 'Norden',
  east: 'Osten',
  south: 'Süden',
  west: 'Westen',
};
