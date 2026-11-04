import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `npm run setup:config` creates api/config.local.php (git-ignored) with the
// public GitHub client ID and a fresh random session secret. Only the GitHub
// client secret is left for you to paste into the file - it never goes into
// chat or Git. `npm run deploy` uploads the file to the server.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'api', 'config.local.php');
const clientId = process.argv[2] || 'Iv23liRrMx9uIyqq9J90';

if (existsSync(target)) {
  console.error('api/config.local.php existiert bereits - nichts wurde geändert.');
  process.exit(1);
}
if (!/^[A-Za-z0-9]{10,40}$/.test(clientId)) {
  console.error('Die Client-ID sieht ungültig aus.');
  process.exit(1);
}

const sessionSecret = randomBytes(32).toString('hex');
writeFileSync(
  target,
  `<?php

// Local server configuration. Git-ignored; uploaded by \`npm run deploy\`.

return [
    'github_client_id' => '${clientId}',
    // Paste the GitHub App client secret between the quotes (GitHub shows it once).
    'github_client_secret' => '',
    'session_secret' => '${sessionSecret}',
];
`,
);
console.log('api/config.local.php wurde angelegt.');
console.log("Öffne die Datei und trage bei 'github_client_secret' dein Secret ein, dann: npm run deploy");
