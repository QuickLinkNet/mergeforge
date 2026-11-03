<?php

declare(strict_types=1);

// Single entry point of the MERGEFORGE API (see .htaccess).
// Live at https://mergeforge.red-it.org/api. Secrets belong in
// config.local.php (git-ignored, see api/config.example.php), never in Git.

const API_VERSION = '0.2.0';

require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/players.php';
require __DIR__ . '/lib/github.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && preg_match('#^https://(mergeforge|www)\.red-it\.org$|^http://(localhost|127\.0\.0\.1):\d+$#', $origin) === 1) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

if ($path === '/me' && $method === 'GET') {
    if (!login_configured()) {
        respond(401, ['ok' => false, 'error' => 'not-signed-in']);
    }
    $session = verify_token($_COOKIE['mf_session'] ?? null);
    $player = is_string($session['pid'] ?? null) ? find_player($session['pid']) : null;
    if ($player === null) {
        respond(401, ['ok' => false, 'error' => 'not-signed-in']);
    }
    respond(200, ['ok' => true, 'player' => $player]);
}

if ($path === '/auth/logout' && $method === 'POST') {
    require_same_origin();
    set_cookie_value('mf_session', '', 0);
    respond(200, ['ok' => true]);
}

respond(404, ['ok' => false, 'error' => 'not-found']);
