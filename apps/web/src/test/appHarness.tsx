import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { createSignalwerkPuzzle } from '@mergeforge/signalwerk';
import { App } from '../App';
import { GAME_SAVE_KEY } from '../persistence';
import { rendererHarness, visibleTileKeys } from './appMocks';

/**
 * Shared setup of the App tests. Each test file still declares the two vi.mock calls itself
 * (see appMocks.ts), because mocks are hoisted per file.
 */

// The double-click guard reads performance.now(); let it run ahead so tests that click quickly
// in a row are not mistaken for double clicks.
let fakeNow = 0;
let clockSpy: ReturnType<typeof vi.spyOn> | undefined;

export function currentClockSpy() {
  return clockSpy;
}

export function installAppTestHooks(): void {
  beforeEach(() => {
    window.localStorage.clear();
    fakeNow = 0;
    clockSpy = vi.spyOn(performance, 'now').mockImplementation(() => (fakeNow += 1000));
  });

  afterEach(() => {
    cleanup();
    clockSpy?.mockRestore();
    vi.clearAllMocks();
    rendererHarness.onHexSelect = undefined;
    window.localStorage.clear();
  });
}

export async function renderReadyApp() {
  const view = render(<App />);
  await waitFor(() => {
    expect(screen.queryByText('Genesis wird kartiert')).toBeNull();
  });
  return view;
}

export function seedSignalwerkReadySave() {
  const signalwerkSeed = 'mergeforge-genesis-001:signalwerk:8,0';
  const puzzle = createSignalwerkPuzzle(signalwerkSeed);
  window.localStorage.setItem(GAME_SAVE_KEY, JSON.stringify({
    formatVersion: 1,
    gameSchemaVersion: 5,
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
    relay: { status: 'dormant', coreInstalled: false },
    lastAdvancedAtMs: 0,
  }));
  return puzzle;
}

export function seedRelayRepairReadySave() {
  const puzzle = seedSignalwerkReadySave();
  const saved = JSON.parse(window.localStorage.getItem(GAME_SAVE_KEY) ?? '{}') as Record<string, any>;
  saved.signalwerk = { ...saved.signalwerk, rotations: puzzle.solutionRotations, solved: true };
  saved.inventory = { resonanceCore: 1 };
  saved.prologue.eventIds = ['relay_discovered', 'signalwerk_solved'];
  saved.buildings.push({
    id: 'workshop:0,0', type: 'workshop', tileKey: '0,0', status: 'active',
    startedAtMs: 0, completesAtMs: 0,
  });
  window.localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(saved));
}
