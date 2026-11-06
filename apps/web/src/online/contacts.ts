import { SIGNAL_BEARINGS, type SignalBearing } from '@mergeforge/domain';
import { request } from './api-client';
import { API_BASE, type RadioContact } from './types';

/** Keeps only well-formed contacts from a /neighbors answer. */
export function parseContacts(body: unknown): RadioContact[] {
  const list = (body as { contacts?: unknown } | null)?.contacts;
  if (!Array.isArray(list)) return [];
  const bands = ['near', 'middle', 'far'];
  return list.flatMap((entry: unknown) => {
    const item = entry as { login?: unknown; bearing?: unknown; distanceBand?: unknown } | null;
    if (
      typeof item?.login !== 'string' ||
      typeof item.bearing !== 'string' ||
      !(SIGNAL_BEARINGS as readonly string[]).includes(item.bearing) ||
      typeof item.distanceBand !== 'string' ||
      !bands.includes(item.distanceBand)
    ) {
      return [];
    }
    return [{ login: item.login, bearing: item.bearing as SignalBearing, distanceBand: item.distanceBand as RadioContact['distanceBand'] }];
  });
}

export async function fetchContacts(fetcher: typeof fetch): Promise<RadioContact[]> {
  try {
    const response = await request(fetcher, `${API_BASE}/neighbors`);
    return response.ok ? parseContacts(await response.json()) : [];
  } catch {
    return [];
  }
}
