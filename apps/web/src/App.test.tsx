import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

interface HexSelection {
  readonly key: string;
  readonly coord: { readonly q: number; readonly r: number };
}

const rendererHarness = vi.hoisted(() => ({
  destroy: vi.fn(),
  update: vi.fn(),
  onHexSelect: undefined as ((event: HexSelection) => void) | undefined,
}));

const visibleTileKeys = ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'];
const meadow = (q: number, r: number) => ({ coord: { q, r }, terrain: 'meadow' as const, elevation: 1 });

vi.mock('@mergeforge/worldgen', () => ({
  generateWorld: vi.fn(() => ({
    seed: 'mergeforge-genesis-001',
    generatorVersion: '1.0.0',
    radius: 7,
    tiles: [
      meadow(0, 0),
      meadow(1, 0),
      meadow(2, 0),
      meadow(1, -1),
      meadow(0, -1),
      meadow(-1, 0),
      meadow(-1, 1),
      meadow(0, 1),
    ],
    village: { id: 'genesis', name: 'Genesis', coord: { q: 0, r: 0 } },
    visibleTileKeys,
  })),
}));

vi.mock('@mergeforge/renderer-pixi', () => ({
  mountHexWorld: vi.fn(async (...args: unknown[]) => {
    const options = args[2] as { onHexSelect?: (event: HexSelection) => void } | undefined;
    rendererHarness.onHexSelect = options?.onHexSelect;
    return { destroy: rendererHarness.destroy, update: rendererHarness.update };
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  rendererHarness.onHexSelect = undefined;
});

async function renderReadyApp() {
  const view = render(<App />);
  await waitFor(() => {
    expect(screen.queryByText('Genesis wird kartiert')).toBeNull();
  });
  return view;
}

describe('MERGEFORGE web shell', () => {
  it('shows the world, current resources, mission, and generator identity', async () => {
    const view = await renderReadyApp();

    expect(screen.getByRole('heading', { name: 'Ein Weg ins Unbekannte' })).toBeTruthy();
    expect(screen.getByText('mergeforge-genesis-001')).toBeTruthy();
    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('0 / 2');

    view.unmount();
    expect(rendererHarness.destroy).toHaveBeenCalledOnce();
  });

  it('previews and confirms two connected roads locally', async () => {
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;
    expect(selectHex).toBeTypeOf('function');

    act(() => selectHex?.({ key: '1,0', coord: { q: 1, r: 0 } }));

    expect(screen.getByRole('heading', { name: 'Weg nach 1, 0' })).toBeTruthy();
    expect(screen.getByText('1 Holz')).toBeTruthy();
    expect(screen.getByText('1 neues Feld')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));

    expect(screen.getByLabelText('Holz: 11')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('1 / 2');

    act(() => selectHex?.({ key: '2,0', coord: { q: 2, r: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));

    expect(screen.getByLabelText('Holz: 10')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('2 / 2');
    expect(screen.getByText('Kapitel 1 · Ziel erreicht')).toBeTruthy();
    expect(rendererHarness.update).toHaveBeenCalled();

    view.unmount();
  });

  it('explains an invalid village build without spending resources', async () => {
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;

    act(() => selectHex?.({ key: '0,0', coord: { q: 0, r: 0 } }));

    expect(
      screen.getByText('Der Dorfkern ist bereits der Ausgangspunkt eures Straßennetzes.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Straße bauen' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('0 / 2');

    view.unmount();
  });
});
