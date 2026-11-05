import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCatalog,
  buildRoad,
  createInitialGameState,
  startLumberCamp,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { BuildMenu, formatClock } from './BuildMenu';
import { entryStatus, fieldCandidates } from './buildMenuStatus';

const world: WorldSnapshot = {
  seed: 'menu-test',
  generatorVersion: 'm1.3-test',
  radius: 1,
  tiles: [
    { coord: { q: 0, r: 0 }, terrain: 'meadow', elevation: 1 },
    { coord: { q: 1, r: 0 }, terrain: 'forest', elevation: 2 },
    { coord: { q: 0, r: 1 }, terrain: 'hills', elevation: 3 },
  ],
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0', '0,1'],
  resourceSites: [{ id: 'stone:0,1', type: 'stone', tileKey: '0,1' }],
  relaySite: { id: 'relay:local:1,0', tileKey: '1,0' },
  surfaceFinds: [],
};

const catalog = buildCatalog([]);
const entry = (id: string) => {
  const found = catalog.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no catalog entry ${id}`);
  return found;
};
const statusOf = (state: GameState, id: string, nowMs = 1_000) =>
  entryStatus(entry(id), state, nowMs, entry(id).placement === 'field' ? fieldCandidates(state, entry(id), []) : []);

function withRoad(): GameState {
  const result = buildRoad(createInitialGameState(world, 0), { q: 1, r: 0 });
  if (!result.ok) throw new Error('road failed');
  return result.state;
}

describe('build menu status', () => {
  it('offers roads and the pathfinder at the start and explains the rest', () => {
    const state = createInitialGameState(world, 0);
    expect(statusOf(state, 'road')).toMatchObject({ kind: 'field', candidates: ['1,0', '0,1'] });
    expect(statusOf(state, 'pathfinder')).toMatchObject({ kind: 'ready' });
    expect(statusOf(state, 'lumber-camp')).toMatchObject({ kind: 'locked', note: 'Zuerst eine Straße bis zu einem Wald-Feld bauen' });
    expect(statusOf(state, 'survey-tent')).toMatchObject({ kind: 'locked', note: 'Zuerst einen Wegfinder ausbilden' });
    expect(statusOf(state, 'workshop').kind).toBe('locked');
    expect(statusOf(state, 'relay-repair').kind).toBe('locked');
    expect(statusOf(state, 'signal-scan').kind).toBe('locked');
    expect(statusOf(state, 'market').kind).toBe('locked');
  });

  it('finds the forest field once a road leads there', () => {
    const state = withRoad();
    expect(statusOf(state, 'lumber-camp')).toMatchObject({ kind: 'field', candidates: ['1,0'] });
    expect(statusOf(state, 'quarry').kind).toBe('locked');
  });

  it('shows the running build with its remaining time and blocks the build slot', () => {
    const started = startLumberCamp(withRoad(), { q: 1, r: 0 }, 1_000);
    expect(started.ok).toBe(true);
    const state = started.state;
    const running = statusOf(state, 'lumber-camp', 61_000);
    expect(running).toMatchObject({ kind: 'running', remainingMs: 600_000 - 60_000 });
    expect(statusOf(state, 'pathfinder', 61_000)).toMatchObject({
      kind: 'locked',
      note: expect.stringContaining('Bauplatz'),
    });
  });

  it('names missing resources', () => {
    const state = { ...withRoad(), resources: { wood: 1, stone: 0 } };
    expect(statusOf(state, 'lumber-camp')).toMatchObject({ kind: 'locked', note: 'Es fehlen 3 Holz und 1 Stein' });
  });
});

describe('BuildMenu', () => {
  afterEach(cleanup);

  it('lists every catalog entry with cost and time and passes the action on', () => {
    const state = createInitialGameState(world, 0);
    const onAction = vi.fn();
    render(<BuildMenu state={state} nowMs={1_000} catalog={catalog} modules={[]} onClose={() => undefined} onAction={onAction} />);
    for (const item of catalog.filter((candidate) => candidate.revealAfterChapter === undefined)) expect(screen.getAllByText(item.name).length).toBeGreaterThan(0);
    expect(screen.queryByText('Relaiswerkstatt')).toBeNull();
    expect(screen.getByText('4 Holz · 1 Stein')).toBeTruthy();
    fireEvent.click(screen.getByText('Feld wählen'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'road' }), expect.objectContaining({ kind: 'field' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bauen' }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'pathfinder' }), expect.objectContaining({ kind: 'ready' }));
  });

  it('shows the time-skip test tool only when it is handed in', () => {
    const state = createInitialGameState(world, 0);
    const props = { state, nowMs: 1_000, catalog, modules: [], onClose: () => undefined, onAction: () => undefined };
    const { rerender } = render(<BuildMenu {...props} />);
    expect(screen.queryByText(/vorspulen/)).toBeNull();
    const skip = vi.fn();
    rerender(<BuildMenu {...props} onSkipTime={skip} />);
    fireEvent.click(screen.getByText(/vorspulen/));
    expect(skip).toHaveBeenCalledOnce();
  });

  it('formats the countdown', () => {
    expect(formatClock(600_000)).toBe('10:00');
    expect(formatClock(61_500)).toBe('1:02');
    expect(formatClock(0)).toBe('0:00');
  });
});
