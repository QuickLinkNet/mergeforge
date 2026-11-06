import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFarSignals } from '@mergeforge/domain';
import { GAME_SAVE_KEY } from './persistence';
import { installAppTestHooks, renderReadyApp, seedRelayRepairReadySave } from './test/appHarness';

vi.mock('@mergeforge/worldgen', async () => (await import('./test/appMocks')).worldgenModule());
vi.mock('@mergeforge/renderer-pixi', async () => (await import('./test/appMocks')).rendererModule());

installAppTestHooks();

/** A finished prologue saved as schema 7, with an active quarry on the stone site. */
function seedChapterSevenSave() {
  seedRelayRepairReadySave();
  const saved = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as Record<string, any>;
  saved.gameSchemaVersion = 7;
  saved.inventory = { resonanceCore: 0 };
  saved.relay = { status: 'active', coreInstalled: true, startedAtMs: 0, completesAtMs: 0, capabilities: ['signal_network_active'] };
  saved.signals = createFarSignals('mergeforge-genesis-001', '1.0.0');
  saved.modules = [];
  saved.prologue.completedChapterIds = [3, 4, 5, 6, 7];
  saved.prologue.eventIds = ['relay_discovered', 'signalwerk_solved', 'relay_repaired', 'first_signals_received'];
  saved.buildings.push({
    id: 'quarry:3,0', type: 'quarry', tileKey: '3,0', status: 'active',
    startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0,
  });
  window.localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(saved));
}

describe('phase B sinks in the app', () => {
  it('starts chapter 8 after the prologue and orders the storehouse through its card', async () => {
    seedChapterSevenSave();
    const view = await renderReadyApp();

    // The migrated save is full (base storage) and shows its limit.
    expect(screen.getByText('Kapitel 8 · Gründerwerk')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Das Gründerwerk' })).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('0 / 3');
    expect(screen.getByLabelText('Holz: 300').textContent).toContain('/ 300');

    fireEvent.click(screen.getByRole('button', { name: 'Bauen', expanded: false }));
    const card = screen.getByRole('heading', { name: 'Lagerhaus' }).closest('li');
    if (card === null) throw new Error('Expected the storehouse card');
    expect(card.textContent).toContain('60 Holz · 30 Stein');
    expect(card.textContent).toContain('Stufe 0 von 3');
    expect(screen.getByRole('heading', { name: 'Holzfäller-Ausbau' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Steinbruch-Ausbau' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Bauen' }));

    // The menu closes and the confirmation card takes over.
    expect(screen.getByRole('heading', { name: 'Lagerhaus Stufe 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lagerhaus bauen' }));
    expect(screen.getByText('Lagerhaus Stufe 1 beauftragt · Fertigstellung in 30:00')).toBeTruthy();
    expect(screen.getByLabelText('Holz: 240')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Lagerhaus Stufe 1' })).toBeNull();

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as Record<string, any>;
      expect(persisted.gameSchemaVersion).toBe(8);
      expect(persisted.buildings).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'storehouse', level: 1, status: 'constructing' }),
      ]));
    });

    view.unmount();
  });
});
