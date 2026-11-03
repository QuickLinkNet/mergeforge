import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  buildRoad,
  createInitialGameState,
  type GameState,
  type ModuleManifest,
  type WorldSnapshot,
} from '@mergeforge/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleBuildPanel } from './ModuleBuildPanel';
import type { LoadedModule } from './moduleRegistry';

afterEach(cleanup);

const PULSE = 10 * 60 * 1000;
const manifest: ModuleManifest = {
  manifestVersion: 1,
  id: 'harzsammler',
  version: '1.0.0',
  name: 'Harzsammler',
  building: {
    placement: { terrain: ['forest'], requiresRoadConnection: true },
    cost: { wood: 3, stone: 1 },
    buildTimeMs: PULSE,
    icon: 'icon.svg',
    production: { resource: 'wood', amountPerPulse: 1 },
  },
};
const modules: readonly LoadedModule[] = [
  { manifest, icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"></svg>' },
];

const world: WorldSnapshot = {
  seed: 'panel-seed',
  generatorVersion: 'panel-test',
  radius: 5,
  tiles: Array.from({ length: 6 }, (_, q) => ({
    coord: { q, r: 0 },
    terrain: q === 2 ? ('forest' as const) : ('meadow' as const),
    elevation: 1,
  })),
  village: { id: 'village-0', name: 'Genesis', coord: { q: 0, r: 0 } },
  visibleTileKeys: ['0,0', '1,0'],
  resourceSites: [],
  relaySite: { id: 'relay:local:5,0', tileKey: '5,0' },
  surfaceFinds: [],
};

function stateWithForestRoad(resources = { wood: 10, stone: 5 }): GameState {
  let state = createInitialGameState(world, 0);
  for (const q of [1, 2]) {
    const road = buildRoad(state, { q, r: 0 });
    if (!road.ok) throw new Error(road.reason);
    state = road.state;
  }
  return { ...state, resources };
}

describe('ModuleBuildPanel', () => {
  it('offers a manifest-defined building with its cost, time and yield', () => {
    const onBuild = vi.fn();
    render(
      <ModuleBuildPanel state={stateWithForestRoad()} coord={{ q: 2, r: 0 }} nowMs={0} modules={modules} onBuild={onBuild} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Harzsammler' })).toBeTruthy();
    expect(screen.getByText('3 Holz · 1 Stein')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('+1 Holz / Takt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Harzsammler errichten' }));
    expect(onBuild).toHaveBeenCalledWith(manifest);
  });

  it('shows why building is not possible yet and disables the action', () => {
    render(
      <ModuleBuildPanel state={stateWithForestRoad({ wood: 0, stone: 0 })} coord={{ q: 2, r: 0 }} nowMs={0} modules={modules} onBuild={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('status').textContent).toContain('Es fehlen Holz oder Stein');
    expect((screen.getByRole('button', { name: 'Harzsammler errichten' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows nothing on terrain the module does not allow', () => {
    const { container } = render(
      <ModuleBuildPanel state={stateWithForestRoad()} coord={{ q: 1, r: 0 }} nowMs={0} modules={modules} onBuild={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('.module-card')).toBeNull();
  });

  it('renders the icon through an image, never as inline markup', () => {
    const scripted: LoadedModule[] = [{ manifest, icon: '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>' }];
    const { container } = render(
      <ModuleBuildPanel state={stateWithForestRoad()} coord={{ q: 2, r: 0 }} nowMs={0} modules={scripted} onBuild={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img.module-icon')?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  });
});
