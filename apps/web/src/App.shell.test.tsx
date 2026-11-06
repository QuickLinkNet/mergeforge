import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '@mergeforge/domain';
import { generateWorld } from '@mergeforge/worldgen';
import { GAME_SAVE_KEY, saveGame } from './persistence';
import { App } from './App';
import { currentClockSpy, installAppTestHooks, renderReadyApp } from './test/appHarness';
import { rendererHarness } from './test/appMocks';

vi.mock('@mergeforge/worldgen', async () => (await import('./test/appMocks')).worldgenModule());
vi.mock('@mergeforge/renderer-pixi', async () => (await import('./test/appMocks')).rendererModule());

installAppTestHooks();

describe('blocked start', () => {
  it('shows only the blocked message and leaves the save untouched when a module is missing', async () => {
    const world = generateWorld({ seed: 'mergeforge-genesis-001', radius: 12 });
    const state = { ...createInitialGameState(world, 0), modules: [{ id: 'ghost', version: '1.0.0' }] };
    saveGame(window.localStorage, state);
    const stored = window.localStorage.getItem(GAME_SAVE_KEY);

    const view = render(<App />);

    expect(await screen.findByText('Spielstand gesperrt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erneut prüfen' })).toBeTruthy();
    expect(await screen.findByText(/ghost \(1\.0\.0\)/)).toBeTruthy();
    expect(document.querySelector('.game-shell.is-halted')).not.toBeNull();
    expect(window.localStorage.getItem(GAME_SAVE_KEY)).toBe(stored);
    view.unmount();
  });
});

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

  it('ignores a fast second click on a confirm button', async () => {
    const view = await renderReadyApp();
    const selectHex = rendererHarness.onHexSelect;
    currentClockSpy()?.mockImplementation(() => 5000);

    act(() => selectHex?.({ key: '1,0', coord: { q: 1, r: 0 } }));
    const build = screen.getByRole('button', { name: 'Straße bauen' });
    fireEvent.click(build);
    fireEvent.click(build);

    // One road costs 1 wood; a second command would have been a second road or a stray action.
    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
    view.unmount();
  });

  it('restores roads, resources, finds, and progress after remounting', async () => {
    const firstView = await renderReadyApp();
    const firstSelectHex = rendererHarness.onHexSelect;

    act(() => firstSelectHex?.({ key: '1,0', coord: { q: 1, r: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Straße bauen' }));
    await waitFor(() => expect(window.localStorage.getItem(GAME_SAVE_KEY)).not.toBeNull());
    firstView.unmount();

    const restoredView = await renderReadyApp();
    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('1 / 2');
    expect(rendererHarness.update).toHaveBeenCalled();
    restoredView.unmount();
  });

  it('resets a corrupt save with a clear message', async () => {
    window.localStorage.setItem(GAME_SAVE_KEY, '{not-json');
    const view = await renderReadyApp();

    expect(
      screen.getByText('Der lokale Spielstand war beschädigt und wurde sicher zurückgesetzt.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
    view.unmount();
  });
});
