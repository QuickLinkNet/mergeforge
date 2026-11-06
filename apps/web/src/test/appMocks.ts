import { vi } from 'vitest';

/**
 * Module mocks for the App tests. Only depends on vitest, so the mock factories can import
 * it without pulling in the mocked packages themselves:
 *   vi.mock('@mergeforge/worldgen', async () => (await import('./test/appMocks')).worldgenModule());
 */

export interface HexSelection {
  readonly key: string;
  readonly coord: { readonly q: number; readonly r: number };
}

export const rendererHarness = {
  destroy: vi.fn(),
  update: vi.fn(),
  onHexSelect: undefined as ((event: HexSelection) => void) | undefined,
};

export const visibleTileKeys = ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
const meadow = (q: number, r: number) => ({ coord: { q, r }, terrain: 'meadow' as const, elevation: 1 });
const forest = (q: number, r: number) => ({ coord: { q, r }, terrain: 'forest' as const, elevation: 2 });
const hills = (q: number, r: number) => ({ coord: { q, r }, terrain: 'hills' as const, elevation: 3 });

/** A tiny fixed world: forest at 2,0, stone site at 3,0, stone find at 2,-1, relay at 8,0. */
export function worldgenModule() {
  return {
    generateWorld: vi.fn(() => ({
      seed: 'mergeforge-genesis-001',
      generatorVersion: '1.0.0',
      radius: 12,
      tiles: [
        meadow(0, 0),
        meadow(1, 0),
        forest(2, 0),
        hills(3, 0),
        meadow(2, -1),
        meadow(4, 0),
        meadow(5, 0),
        meadow(6, 0),
        meadow(7, 0),
        meadow(8, 0),
        meadow(1, -1),
        meadow(0, -1),
        meadow(-1, 0),
        meadow(-1, 1),
        meadow(0, 1),
      ],
      village: { id: 'genesis', name: 'Genesis', coord: { q: 0, r: 0 } },
      visibleTileKeys,
      resourceSites: [{ id: 'stone:3,0', type: 'stone', tileKey: '3,0' }],
      relaySite: { id: 'relay:local:8,0', tileKey: '8,0' },
      surfaceFinds: [{ id: 'surface-find:stone:2,-1', resourceType: 'stone', tileKey: '2,-1', amount: 4 }],
    })),
  };
}

/** Renderer stand-in that records updates and exposes the hex selection callback. */
export function rendererModule() {
  return {
    mountHexWorld: vi.fn(async (...args: unknown[]) => {
      const options = args[2] as { onHexSelect?: (event: HexSelection) => void } | undefined;
      rendererHarness.onHexSelect = options?.onHexSelect;
      return { destroy: rendererHarness.destroy, update: rendererHarness.update };
    }),
  };
}
