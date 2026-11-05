// Rewrites docs/TECH_TREE.svg from the build catalog and the modules in modules/.
// The picture is produced by packages/domain/src/techtree.ts; this script only runs
// the catalog test in "write" mode, so no extra tooling is needed.
//
//   npm run techtree

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.execPath,
  [join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'src/techtree.file.test.mjs'],
  { cwd: join(root, 'packages', 'domain'), env: { ...process.env, WRITE_TECHTREE: '1' }, stdio: 'inherit' },
);
if (result.status === 0) console.log('docs/TECH_TREE.svg is up to date.');
process.exit(result.status ?? 1);
