import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './loadEnv.mjs';

// `npm run deploy` builds first, then runs this script: it uploads the built
// frontend (apps/web/dist) and the PHP API (api/) over FTP(S) using curl, so
// the repository needs no extra dependency. Credentials live only in
// .env.deploy (never in Git). The script uploads files and only ever deletes
// old hashed bundles inside <REMOTE_BASE_DIR>/assets - nothing else.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
loadEnvFile('.env.deploy');

const remoteBase = (process.env.REMOTE_BASE_DIR || '/html/apps/mergeforge').replace(/\/+$/, '');
const distDir = path.join('apps', 'web', 'dist');
const apiDir = 'api';
// Never uploaded: local configuration and runtime data of the API.
const apiSkip = new Set(['config.local.php', 'data']);

function fail(message) {
  console.error(`Deploy abgebrochen: ${message}`);
  process.exit(1);
}

if (!remoteBase.endsWith('/mergeforge')) {
  fail(`REMOTE_BASE_DIR ("${remoteBase}") sieht nicht sicher aus. Erwartet einen Pfad, der auf "/mergeforge" endet.`);
}
for (const key of ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD']) {
  if (!process.env[key]) fail(`${key} fehlt. Bitte .env.deploy anlegen (siehe .env.deploy.example).`);
}
if (!existsSync(path.join(distDir, 'index.html'))) {
  fail('apps/web/dist fehlt. "npm run deploy" baut zuerst - bitte nicht einzeln aufrufen.');
}
if (!existsSync(path.join(apiDir, 'index.php'))) fail('api/index.php fehlt.');

const port = Number(process.env.FTP_PORT || 21);
const secure = (process.env.FTP_SECURE ?? 'true') !== 'false';
const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const urlFor = (remotePath) =>
  `ftp://${process.env.FTP_HOST}:${port}${remotePath.split('/').map(encodeURIComponent).join('/')}`;

// Runs curl with its config on stdin, so the password never appears in the process list.
function curl(remoteUrl, extra = []) {
  const config = [
    `url = ${quote(remoteUrl)}`,
    `user = ${quote(`${process.env.FTP_USER}:${process.env.FTP_PASSWORD}`)}`,
    ...extra,
    ...(secure ? ['ssl-reqd', 'ftp-ssl-control'] : []),
    'silent',
    'show-error',
    'connect-timeout = 20',
    'max-time = 120',
  ].join('\n');
  const result = spawnSync('curl', ['-K', '-'], { input: config, encoding: 'utf8' });
  if (result.error) fail(`curl nicht aufrufbar: ${result.error.message}`);
  return result;
}

function upload(localFile, remotePath) {
  const result = curl(urlFor(remotePath), [`upload-file = ${quote(localFile)}`, 'ftp-create-dirs']);
  if (result.status !== 0) fail(`Upload von ${localFile} fehlgeschlagen: ${result.stderr.trim()}`);
}

function* filesIn(dir, skip = new Set()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* filesIn(full);
    else yield full;
  }
}

function uploadTree(localDir, remoteDir, skip) {
  let count = 0;
  for (const file of filesIn(localDir, skip)) {
    const relative = path.relative(localDir, file).split(path.sep).join('/');
    upload(file, `${remoteDir}/${relative}`);
    count += 1;
  }
  return count;
}

// Removes stale hashed bundles of earlier builds; the folder holds nothing else.
function cleanAssets() {
  const listing = curl(`${urlFor(`${remoteBase}/assets`)}/`, ['list-only']);
  if (listing.status !== 0) return; // first deploy: folder does not exist yet
  for (const name of listing.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    if (name.includes('/') || name === '.' || name === '..') continue;
    curl(urlFor(`${remoteBase}/assets/`), [`quote = ${quote(`-DELE ${remoteBase}/assets/${name}`)}`, 'head']);
  }
}

console.log(`Verbinde mit ${process.env.FTP_HOST}:${port} (secure=${secure}) ...`);
cleanAssets();
console.log('Lade Frontend hoch ...');
const frontendCount = uploadTree(distDir, remoteBase);
console.log('Lade API hoch ...');
const apiCount = uploadTree(apiDir, `${remoteBase}/api`, apiSkip);

console.log('');
console.log(`Fertig: ${frontendCount} Frontend- und ${apiCount} API-Dateien.`);
console.log(`Erreichbar unter: ${process.env.PUBLIC_URL || 'https://mergeforge.red-it.org'}/`);
