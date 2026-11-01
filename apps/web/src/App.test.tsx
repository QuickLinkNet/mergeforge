import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignalwerkPuzzle } from '@mergeforge/signalwerk';
import { App } from './App';
import { GAME_SAVE_KEY } from './persistence';

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
const forest = (q: number, r: number) => ({ coord: { q, r }, terrain: 'forest' as const, elevation: 2 });
const hills = (q: number, r: number) => ({ coord: { q, r }, terrain: 'hills' as const, elevation: 3 });

vi.mock('@mergeforge/worldgen', () => ({
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
}));

vi.mock('@mergeforge/renderer-pixi', () => ({
  mountHexWorld: vi.fn(async (...args: unknown[]) => {
    const options = args[2] as { onHexSelect?: (event: HexSelection) => void } | undefined;
    rendererHarness.onHexSelect = options?.onHexSelect;
    return { destroy: rendererHarness.destroy, update: rendererHarness.update };
  }),
}));

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  rendererHarness.onHexSelect = undefined;
  window.localStorage.clear();
});

async function renderReadyApp() {
  const view = render(<App />);
  await waitFor(() => {
    expect(screen.queryByText('Genesis wird kartiert')).toBeNull();
  });
  return view;
}

function seedSignalwerkReadySave() {
  const signalwerkSeed = 'mergeforge-genesis-001:signalwerk:8,0';
  const puzzle = createSignalwerkPuzzle(signalwerkSeed);
  window.localStorage.setItem(GAME_SAVE_KEY, JSON.stringify({
    formatVersion: 1,
    gameSchemaVersion: 4,
    world: { seed: 'mergeforge-genesis-001', generatorVersion: '1.0.0', radius: 12 },
    resources: { wood: 20, stone: 12 },
    roadTileKeys: ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0', '8,0'],
    visibleTileKeys: [...visibleTileKeys, '2,0', '3,0', '4,0', '5,0', '6,0', '7,0', '8,0'],
    claimedSurfaceFindTileKeys: [],
    buildings: [
      {
        id: 'lumber-camp:2,0', type: 'lumber-camp', tileKey: '2,0', status: 'active',
        startedAtMs: 0, completesAtMs: 0, lastProductionAtMs: 0,
      },
      {
        id: 'survey-tent:0,0', type: 'survey-tent', tileKey: '0,0', status: 'active',
        startedAtMs: 0, completesAtMs: 0,
      },
    ],
    units: [{
      id: 'pathfinder', type: 'pathfinder', status: 'active', tileKey: '8,0', charges: 1,
      startedAtMs: 0, completesAtMs: 0, lastChargeAtMs: 0,
    }],
    prologue: {
      stoneProductionObserved: true,
      pathfinderSurveysCompleted: 1,
      completedChapterIds: [3, 4, 5],
      eventIds: ['relay_discovered'],
    },
    signalwerk: { seed: signalwerkSeed, rotations: puzzle.initialRotations, solved: false },
    inventory: { resonanceCore: 0 },
    lastAdvancedAtMs: 0,
  }));
  return puzzle;
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

  it('resets a corrupt save with a clear message', async () => {
    window.localStorage.setItem(GAME_SAVE_KEY, '{not-json');
    const view = await renderReadyApp();

    expect(
      screen.getByText('Der lokale Spielstand war beschädigt und wurde sicher zurückgesetzt.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Holz: 12')).toBeTruthy();
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

    expect(screen.getByText('1 Resonanzkern · nicht installiert')).toBeTruthy();
    expect(screen.getByLabelText('Resonanzkern: 1, nicht installiert')).toBeTruthy();
    expect(screen.getByLabelText('Kapitelziel').textContent).toContain('1 / 1');
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as {
        inventory?: { resonanceCore?: number };
        prologue?: { eventIds?: string[] };
      };
      expect(saved.inventory?.resonanceCore).toBe(1);
      expect(saved.prologue?.eventIds).toEqual(['relay_discovered', 'signalwerk_solved']);
    });

    view.unmount();
  });
});
