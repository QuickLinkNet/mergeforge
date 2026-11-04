<?php

declare(strict_types=1);

// Single entry point of the MERGEFORGE API (see .htaccess).
// Live at https://mergeforge.red-it.org/api. Secrets belong in
// config.local.php (git-ignored, see api/config.example.php), never in Git.

const API_VERSION = '0.3.0';

require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/players.php';
require __DIR__ . '/lib/github.php';
require __DIR__ . '/lib/saves.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && preg_match('#^https://(mergeforge|www)\.red-it\.org$|^http://(localhost|127\.0\.0\.1):\d+$#', $origin) === 1) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
    header('Vary: Origin');
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Path relative to this folder, e.g. "/health".
$path = '/' . trim(substr((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), strlen(api_base())), '/');

if ($path === '/health' && $method === 'GET') {
    respond(200, [
        'ok' => true,
        'service' => 'mergeforge-api',
        'version' => API_VERSION,
        'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
        'loginConfigured' => login_configured(),
        'storage' => storage_available(),
        'time' => gmdate('c'),
    ]);
}

if ($path === '/auth/login' && $method === 'GET') {
    if (!login_configured()) {
        respond(503, ['ok' => false, 'error' => 'login-not-configured']);
    }
    $state = bin2hex(random_bytes(16));
    set_cookie_value('mf_state', sign_token(['s' => $state], 600), 600);
    redirect(github_authorize_url(public_url(api_base() . '/auth/callback'), $state));
}

if ($path === '/auth/callback' && $method === 'GET') {
    if (!login_configured()) {
        respond(503, ['ok' => false, 'error' => 'login-not-configured']);
    }
    $back = app_base();
    $stored = verify_token($_COOKIE['mf_state'] ?? null);
    set_cookie_value('mf_state', '', 0);
    $state = $_GET['state'] ?? null;
    $code = $_GET['code'] ?? null;

    if (isset($_GET['error'])) {
        redirect($back . '?login=denied');
    }
    if (!is_string($state) || !is_string($code) || $code === '' || $stored === null
        || !is_string($stored['s'] ?? null) || !hash_equals($stored['s'], $state)) {
        redirect($back . '?login=error');
    }
    $identity = github_identity($code, public_url(api_base() . '/auth/callback'));
    if ($identity === null) {
        redirect($back . '?login=error');
    }
    try {
        $player = register_player($identity['id'], $identity['login']);
    } catch (Throwable $error) {
        redirect($back . '?login=error');
    }
    set_cookie_value('mf_session', sign_token(['pid' => $player['playerId']], 60 * 60 * 24 * 30), 60 * 60 * 24 * 30);
    redirect($back . '?login=ok');
}

/** The signed-in player of this request, or a 401 response. */
function require_player(): array
{
    $session = login_configured() ? verify_token($_COOKIE['mf_session'] ?? null) : null;
    $player = is_string($session['pid'] ?? null) ? find_player($session['pid']) : null;
    if ($player === null) {
        respond(401, ['ok' => false, 'error' => 'not-signed-in']);
    }
    return $player;
}

if ($path === '/me' && $method === 'GET') {
    respond(200, ['ok' => true, 'player' => require_player()]);
}

if ($path === '/save' && $method === 'GET') {
    $player = require_player();
    $save = load_save($player['playerId'], ($_GET['meta'] ?? '') !== '1');
    if ($save === null) {
        respond(404, ['ok' => false, 'error' => 'no-save']);
    }
    respond(200, ['ok' => true, 'save' => $save]);
}

if ($path === '/save' && $method === 'PUT') {
    require_same_origin();
    $player = require_player();
    $raw = (string) file_get_contents('php://input', false, null, 0, SAVE_MAX_BYTES + 4096);
    if (strlen($raw) > SAVE_MAX_BYTES + 2048) {
        respond(413, ['ok' => false, 'error' => 'save-too-large']);
    }
    $request = json_decode($raw, true);
    $base = is_array($request) ? ($request['baseRevision'] ?? null) : null;
    $payloadJson = is_array($request) ? ($request['payload'] ?? null) : null;
    if (!is_int($base) || $base < 0 || !is_string($payloadJson) || strlen($payloadJson) > SAVE_MAX_BYTES) {
        respond(400, ['ok' => false, 'error' => 'invalid-request']);
    }
    $error = save_payload_error(json_decode($payloadJson, true));
    if ($error !== null) {
        respond(400, ['ok' => false, 'error' => $error]);
    }
    $result = store_save($player['playerId'], $base, $payloadJson);
    if ($result['ok'] === false) {
        respond(409, ['ok' => false, 'error' => 'conflict', 'revision' => $result['revision']]);
    }
    respond(200, ['ok' => true, 'revision' => $result['revision'], 'updatedAt' => $result['updatedAt']]);
}

if ($path === '/auth/logout' && $method === 'POST') {
    require_same_origin();
    set_cookie_value('mf_session', '', 0);
    respond(200, ['ok' => true]);
}

respond(404, ['ok' => false, 'error' => 'not-found']);
