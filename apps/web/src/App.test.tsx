import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const destroy = vi.fn();

vi.mock('@mergeforge/worldgen', () => ({
  generateWorld: vi.fn(() => ({
    seed: 'mergeforge-genesis-001',
    generatorVersion: '1.0.0',
    radius: 7,
    tiles: [],
    village: { id: 'genesis', name: 'Genesis', coord: { q: 0, r: 0 } },
    visibleTileKeys: ['0,0'],
  })),
}));

vi.mock('@mergeforge/renderer-pixi', () => ({
  mountHexWorld: vi.fn(async () => ({ destroy })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('MERGEFORGE web shell', () => {
  it('shows the world, mission preview, and generator identity', async () => {
    const view = render(<App />);

    expect(screen.getByRole('heading', { name: 'Ein Weg ins Unbekannte' })).toBeTruthy();
    expect(screen.getByText('mergeforge-genesis-001')).toBeTruthy();
    expect(screen.getByLabelText('Startstatus, Vorschau')).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText('Genesis wird kartiert')).toBeNull();
    });

    view.unmount();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
