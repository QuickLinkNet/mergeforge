import { describe, expect, it } from 'vitest';
import {
  LOADED_MODULES,
  MODULE_ICON_MAX_BYTES,
  MODULE_LOAD_ERRORS,
  MODULE_REGISTRY,
  buildModuleRegistry,
} from './moduleRegistry';

const PULSE_MS = 10 * 60 * 1_000;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"></svg>';
const P = '../../../modules/harz';

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    manifestVersion: 1,
    id: 'harz',
    version: '1.0.0',
    name: 'Harz',
    building: {
      placement: { terrain: ['forest'], requiresRoadConnection: true },
      cost: { wood: 3, stone: 1 },
      buildTimeMs: PULSE_MS,
      icon: 'icon.svg',
      production: { resource: 'wood', amountPerPulse: 1 },
    },
    ...overrides,
  };
}

describe('shipped modules', () => {
  it('loads the Harzsammler without any load error', () => {
    expect(MODULE_LOAD_ERRORS).toEqual([]);
    expect(MODULE_REGISTRY).toContainEqual({ id: 'harzsammler', version: '1.0.0' });
    const harz = LOADED_MODULES.find(({ manifest: m }) => m.id === 'harzsammler');
    expect(harz?.manifest.building.production).toEqual({ resource: 'wood', amountPerPulse: 1 });
    expect(harz?.icon).toContain('<svg');
  });
});

describe('module loader', () => {
  it('loads a valid module and exposes id and version', () => {
    const result = buildModuleRegistry({ [`${P}/module.json`]: manifest() }, { [`${P}/icon.svg`]: SVG });
    expect(result.errors).toEqual([]);
    expect(result.registry).toEqual([{ id: 'harz', version: '1.0.0' }]);
  });

  it('skips an invalid manifest and reports why', () => {
    const result = buildModuleRegistry({ [`${P}/module.json`]: manifest({ extra: 1 }) }, { [`${P}/icon.svg`]: SVG });
    expect(result.registry).toEqual([]);
    expect(result.errors.join(' ')).toContain('unknown field "extra"');
  });

  it('requires the id to match the folder name', () => {
    const result = buildModuleRegistry({ [`${P}/module.json`]: manifest({ id: 'other' }) }, { [`${P}/icon.svg`]: SVG });
    expect(result.registry).toEqual([]);
    expect(result.errors.join(' ')).toContain('must equal the folder name');
  });

  it('rejects a missing, oversized or scripted icon', () => {
    const files = { [`${P}/module.json`]: manifest() };
    expect(buildModuleRegistry(files, {}).errors.join(' ')).toContain('not found');
    const big = SVG + ' '.repeat(MODULE_ICON_MAX_BYTES);
    expect(buildModuleRegistry(files, { [`${P}/icon.svg`]: big }).errors.join(' ')).toContain('larger than');
    const scripted = '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>';
    expect(buildModuleRegistry(files, { [`${P}/icon.svg`]: scripted }).errors.join(' ')).toContain('without scripts');
    const handler = '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>';
    expect(buildModuleRegistry(files, { [`${P}/icon.svg`]: handler }).errors.join(' ')).toContain('without scripts');
  });

  it('rejects ids that collide with core buildings', () => {
    const result = buildModuleRegistry(
      { '../../../modules/quarry/module.json': manifest({ id: 'quarry' }) },
      { '../../../modules/quarry/icon.svg': SVG },
    );
    expect(result.registry).toEqual([]);
    expect(result.errors.join(' ')).toContain('already taken');
  });

  it('rejects a path that is not a module manifest', () => {
    const result = buildModuleRegistry({ 'somewhere/else.json': manifest() }, {});
    expect(result.errors.join(' ')).toContain('not a module manifest path');
  });
});
