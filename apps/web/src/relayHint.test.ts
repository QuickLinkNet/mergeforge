import { describe, expect, it } from 'vitest';
import { compassDirection } from './relayHint';

describe('compassDirection', () => {
  const origin = { q: 0, r: 0 };
  it('names the eight directions on screen', () => {
    expect(compassDirection(origin, { q: 5, r: 0 })).toBe('Osten');
    expect(compassDirection(origin, { q: -5, r: 0 })).toBe('Westen');
    expect(compassDirection(origin, { q: 0, r: 5 })).toBe('Südosten');
    expect(compassDirection(origin, { q: 0, r: -5 })).toBe('Nordwesten');
    expect(compassDirection(origin, { q: 5, r: -5 })).toBe('Nordosten');
    expect(compassDirection(origin, { q: -5, r: 5 })).toBe('Südwesten');
    expect(compassDirection(origin, { q: 3, r: -6 })).toBe('Norden');
    expect(compassDirection(origin, { q: -3, r: 6 })).toBe('Süden');
  });
});
