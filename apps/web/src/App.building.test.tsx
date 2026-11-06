import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installAppTestHooks, renderReadyApp } from './test/appHarness';
import { rendererHarness } from './test/appMocks';

vi.mock('@mergeforge/worldgen', async () => (await import('./test/appMocks')).worldgenModule());
vi.mock('@mergeforge/renderer-pixi', async () => (await import('./test/appMocks')).rendererModule());

installAppTestHooks();

describe('building in the first chapters', () => {
  it('previews and confirms two connected roads locally', async () => {
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;
    expect(selectHex).toBeTypeOf('function');

    act(() => selectHex?.({ key: '1,0', coord: { q: 1, r: 0 } }));

    expect(screen.getByRole('heading', { name: 'Weg nach 1, 0' })).toBeTruthy();
    expect(screen.getByText('1 Holz')).toBeTruthy();
    expect(screen.getByText('2 neue Felder')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));

    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
    expect(screen.getByText('Funde geborgen · +1 Holz · +4 Stein')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('1 / 2');

    act(() => selectHex?.({ key: '2,0', coord: { q: 2, r: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));

    expect(screen.getByLabelText('Holz: 11')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('0 / 1');
    expect(screen.getByText('Kapitel 2 · Waldlinie')).toBeTruthy();
    expect(rendererHarness.update).toHaveBeenCalled();

    view.unmount();
  });

  it('builds a lumber camp on a connected forest road and shows its timer', async () => {
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;

    act(() => selectHex?.({ key: '1,0', coord: { q: 1, r: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));
    act(() => selectHex?.({ key: '2,0', coord: { q: 2, r: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));
    act(() => selectHex?.({ key: '2,0', coord: { q: 2, r: 0 } }));

    expect(screen.getByRole('heading', { name: 'Holzfällerlager' })).toBeTruthy();
    expect(screen.getByText('4 Holz · 1 Stein')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lager errichten' }));

    expect(screen.getByRole('heading', { name: 'Bau läuft' })).toBeTruthy();
    expect(screen.getByLabelText('Holz: 7')).toBeTruthy();
    expect(screen.getByLabelText('Stein: 9')).toBeTruthy();
    expect(screen.getByText('Fertig in')).toBeTruthy();
    expect(screen.getByText('Am Bauende wird das Holzfällerlager aktiv und liefert sofort 2 Holz.')).toBeTruthy();
    expect(screen.getByText('Kapitel 3 · Steinlinie')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Stein und Sicht' })).toBeTruthy();
    expect(screen.getByText('Erste Steinproduktion erhalten')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('0 / 2');
    view.unmount();
  });

  it('previews and starts a quarry only on the connected stone site', async () => {
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;

    for (const [key, q] of [['1,0', 1], ['2,0', 2], ['3,0', 3]] as const) {
      act(() => selectHex?.({ key, coord: { q, r: 0 } }));
      fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));
    }
    act(() => selectHex?.({ key: '3,0', coord: { q: 3, r: 0 } }));

    expect(screen.getByRole('heading', { name: 'Steinbruch' })).toBeTruthy();
    expect(screen.getByText('3 Holz · 1 Stein')).toBeTruthy();
    expect(screen.getByText('+1 Stein / Takt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Steinbruch errichten' }));

    expect(screen.getByRole('heading', { name: 'Bau läuft' })).toBeTruthy();
    expect(screen.getByLabelText('Holz: 7')).toBeTruthy();
    expect(screen.getByLabelText('Stein: 9')).toBeTruthy();
    expect(rendererHarness.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        buildings: expect.arrayContaining([expect.objectContaining({ type: 'quarry' })]),
      }),
    );
    view.unmount();
  });

  it('offers pathfinder training at the village and spends only after confirmation', async () => {
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;

    act(() => selectHex?.({ key: '0,0', coord: { q: 0, r: 0 } }));

    expect(screen.getByRole('heading', { name: 'Wegfinder' })).toBeTruthy();
    expect(screen.getByText('2 Holz · 2 Stein')).toBeTruthy();
    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ausbildung beginnen' }));

    expect(screen.getByRole('heading', { name: 'Ausbildung läuft' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Weg nach 0, 0' })).toBeNull();
    expect(screen.getByLabelText('Holz: 10')).toBeTruthy();
    expect(screen.getByLabelText('Stein: 4')).toBeTruthy();
    expect(screen.getByLabelText('Expeditionsladungen: 0 von 6')).toBeTruthy();
    expect(rendererHarness.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ wayfinder: expect.objectContaining({ state: 'training', tileKey: '0,0' }) }),
    );

    view.unmount();
  });
});
