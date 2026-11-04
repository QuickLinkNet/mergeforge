import { loadEnvFile } from './loadEnv.mjs';

// Smoke test against the deployed site: frontend answers and the API health
// endpoint reports ok. `npm run live:check`, no local server needed.

loadEnvFile('.env.deploy');
const publicUrl = (process.env.PUBLIC_URL || 'https://mergeforge.red-it.org').replace(/\/+$/, '');
let failed = false;

async function check(name, url, test) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'mergeforge-live-check' } });
    const text = await response.text();
    const problem = test(response, text);
    console.log(`${problem ? 'FAIL' : 'ok  '} ${name} (${response.status}) ${url}${problem ? ` - ${problem}` : ''}`);
    if (problem) failed = true;
  } catch (error) {
    console.log(`FAIL ${name} ${url} - ${error.message}`);
    failed = true;
  }
}

await check('frontend', `${publicUrl}/`, (response, text) =>
  response.status === 200 && text.includes('MERGEFORGE') ? '' : 'index.html not served',
);
await check('api health', `${publicUrl}/api/health`, (response, text) => {
  try {
    const body = JSON.parse(text);
    return response.status === 200 && body.ok === true && body.service === 'mergeforge-api' ? '' : 'unexpected body';
  } catch {
    return 'not JSON';
  }
});
await check('api login (signed out)', `${publicUrl}/api/me`, (response) =>
  response.status === 401 ? '' : 'expected 401 without a session',
);
const health = await fetch(`${publicUrl}/api/health`).then((r) => r.json()).catch(() => ({}));
if (health.loginConfigured === true) {
  const redirect = await fetch(`${publicUrl}/api/auth/login`, { redirect: 'manual' });
  const target = redirect.headers.get('location') ?? '';
  const ok = redirect.status === 302 && target.startsWith('https://github.com/login/oauth/authorize?');
  console.log(`${ok ? 'ok  ' : 'FAIL'} api login redirect (${redirect.status})`);
  if (!ok) failed = true;
} else {
  console.log('skip api login redirect (login not configured on the server yet)');
}
await check('api unknown route', `${publicUrl}/api/does-not-exist`, (response) =>
  response.status === 404 ? '' : 'expected 404',
);

process.exit(failed ? 1 : 0);
