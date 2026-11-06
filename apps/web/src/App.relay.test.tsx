import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GAME_SAVE_KEY } from './persistence';
import {
  installAppTestHooks,
  renderReadyApp,
  seedRelayRepairReadySave,
  seedSignalwerkReadySave,
} from './test/appHarness';
import { rendererHarness } from './test/appMocks';

vi.mock('@mergeforge/worldgen', async () => (await import('./test/appMocks')).worldgenModule());
vi.mock('@mergeforge/renderer-pixi', async () => (await import('./test/appMocks')).rendererModule());

installAppTestHooks();

describe('relay, Signalwerk and far signals', () => {
  it('opens, solves, and persists Signalwerk without duplicating the resonance core', async () => {
    const puzzle = seedSignalwerkReadySave();
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;

    expect(screen.getByText('Kapitel 6 · Resonanzkern')).toBeTruthy();
    act(() => selectHex?.({ key: '8,0', coord: { q: 8, r: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Signalwerk öffnen' }));
    expect(screen.getByRole('dialog', { name: 'Signalwerk' })).toBeTruthy();

    const runes = screen.getAllByRole('gridcell');
    puzzle.solutionRotations.forEach((target, index) => {
      const current = puzzle.initialRotations[index] ?? 0;
      const turns = (target - current + 4) % 4;
      for (let turn = 0; turn < turns; turn += 1) fireEvent.click(runes[index]!);
    });

    expect(screen.getByText('1 Resonanzkern · bereit')).toBeTruthy();
    expect(screen.getByLabelText('Resonanzkern: im Inventar')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('1 / 3');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Karte' }));
    act(() => selectHex?.({ key: '0,0', coord: { q: 0, r: 0 } }));
    expect(screen.getByRole('heading', { name: 'Relaiswerkstatt' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Werkstatt errichten' }));
    expect(screen.getByLabelText('Stein: 8')).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as {
        inventory?: { resonanceCore?: number };
        prologue?: { eventIds?: string[] };
        buildings?: { type?: string; status?: string }[];
      };
      expect(saved.inventory?.resonanceCore).toBe(1);
      expect(saved.prologue?.eventIds).toEqual(['relay_discovered', 'signalwerk_solved']);
      expect(saved.buildings).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'workshop', status: 'constructing' }),
      ]));
    });

    view.unmount();
  });

  it('installs the core and persists the one-time relay repair', async () => {
    seedRelayRepairReadySave();
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;

    act(() => selectHex?.({ key: '8,0', coord: { q: 8, r: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Kern installieren · Reparatur starten' }));

    expect(screen.getByLabelText('Resonanzkern: installiert')).toBeTruthy();
    expect(screen.getByText('Reparatur läuft')).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as {
        inventory?: { resonanceCore?: number };
        relay?: { status?: string; coreInstalled?: boolean };
      };
      expect(saved.inventory?.resonanceCore).toBe(0);
      expect(saved.relay).toMatchObject({ status: 'repairing', coreInstalled: true });
    });

    view.unmount();
  });

  it('shows two coarse far signals only after the player scans for them', async () => {
    seedRelayRepairReadySave();
    const beforeView = await renderReadyApp();
    expect(screen.queryByRole('heading', { name: 'Fernsignale' })).toBeNull();
    beforeView.unmount();

    const saved = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as Record<string, any>;
    saved.relay = { status: 'active', coreInstalled: true, startedAtMs: 0, completesAtMs: 0 };
    saved.inventory = { resonanceCore: 0 };
    // A pre-chapter-7 save: the first render already re-saved it as schema 6.
    saved.gameSchemaVersion = 5;
    delete saved.signals;
    saved.prologue.completedChapterIds = [3, 4, 5, 6];
    saved.prologue.eventIds = ['relay_discovered', 'signalwerk_solved', 'relay_repaired'];
    window.localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(saved));

    const view = await renderReadyApp();

    // Chapter 6 is done, but chapter 7 waits for the explicit scan action.
    expect(screen.getByText('Kapitel 7 · Erstes Signal')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('0 / 2');
    expect(screen.queryByRole('heading', { name: 'Fernsignale' })).toBeNull();
    const savedBeforeScan = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as Record<string, any>;
    expect(savedBeforeScan.signals).toEqual([]);
    expect(savedBeforeScan.prologue.completedChapterIds).toEqual([3, 4, 5, 6]);

    fireEvent.click(screen.getByRole('button', { name: 'Fernsignal scannen' }));

    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('2 / 2');
    expect(screen.queryByRole('button', { name: 'Fernsignal scannen' })).toBeNull();
    const panel = screen.getByRole('heading', { name: 'Fernsignale' }).closest('section');
    expect(panel).not.toBeNull();
    const items = panel?.querySelectorAll('.signal-item') ?? [];
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.textContent).toMatch(/ca\. \d{2}–\d{2} Felder/);
    }
    // No exact coordinates or foreign terrain: the panel shows no "q, r" pair.
    expect(panel?.textContent).not.toMatch(/-?\d+\s*,\s*-?\d+/);

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as Record<string, any>;
      expect(persisted.gameSchemaVersion).toBe(7);
      expect(persisted.signals).toHaveLength(2);
      expect(persisted.relay.capabilities).toEqual(['signal_network_active']);
      expect(persisted.prologue.completedChapterIds).toEqual([3, 4, 5, 6, 7]);
    });

    view.unmount();
  });
});
