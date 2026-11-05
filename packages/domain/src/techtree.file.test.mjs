// Keeps docs/TECH_TREE.svg in step with the build catalog and the modules in modules/.
// Plain .mjs on purpose: it reads files, and the domain package is typed without Node types.
// Rewrite the picture with `npm run techtree`.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WORLD_PULSE_MS, buildCatalog, coreCatalog, renderTechTreeSvg, validateModuleManifest } from './index';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function repoModules() {
  const dir = join(repoRoot, 'modules');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const raw = JSON.parse(readFileSync(join(dir, entry.name, 'module.json'), 'utf8'));
      const result = validateModuleManifest(raw, { pulseMs: WORLD_PULSE_MS, reservedIds: coreCatalog().map((item) => item.id) });
      return result.ok ? [result.manifest] : [];
    });
}

describe('tech tree picture', () => {
  const catalog = buildCatalog(repoModules());
  const svg = renderTechTreeSvg(catalog);
  const file = join(repoRoot, 'docs', 'TECH_TREE.svg');

  it('is deterministic and shows every entry', () => {
    expect(renderTechTreeSvg(buildCatalog(repoModules()))).toBe(svg);
    for (const entry of catalog) expect(svg).toContain(entry.name);
  });

  it('matches docs/TECH_TREE.svg (run `npm run techtree` after changing the catalog or a module)', () => {
    if (process.env.WRITE_TECHTREE === '1') writeFileSync(file, svg);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).toBe(svg);
  });
});
