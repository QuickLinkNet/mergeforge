<?php

declare(strict_types=1);

// Shared helpers: config, JSON/redirect responses, signed cookies, request origin.

const ALLOWED_HOSTS = ['mergeforge.red-it.org', 'www.red-it.org', 'localhost', '127.0.0.1'];

function config(): array
{
    static $config = null;
    if (isset($GLOBALS['mf_config_override'])) {
        return $GLOBALS['mf_config_override']; // tests only
    }
    if ($config === null) {
        $file = __DIR__ . '/../config.local.php';
        $loaded = is_file($file) ? require $file : [];
        $config = is_array($loaded) ? $loaded : [];
    }
    return $config;
}

function config_string(string $key): string
{
    $value = config()[$key] ?? '';
    return is_string($value) ? trim($value) : '';
}

function login_configured(): bool
{
    return config_string('github_client_id') !== ''
        && config_string('github_client_secret') !== ''
        && strlen(config_string('session_secret')) >= 32;
}

function respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function redirect(string $location): void
{
    http_response_code(302);
    header('Location: ' . $location);
    header('Cache-Control: no-store');
    exit;
}

function b64url_encode(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function b64url_decode(string $text): string|false
{
    return base64_decode(strtr($text, '-_', '+/'), true);
}

/** HMAC-signed, expiring token; used for the login state and the session cookie. */
function sign_token(array $payload, int $ttlSeconds): string
{
    $payload['exp'] = time() + $ttlSeconds;
    $body = b64url_encode((string) json_encode($payload));
    return $body . '.' . b64url_encode(hash_hmac('sha256', $body, config_string('session_secret'), true));
}

function verify_token(?string $token): ?array
{
    if ($token === null || substr_count($token, '.') !== 1) {
        return null;
    }
    [$body, $signature] = explode('.', $token);
    $expected = b64url_encode(hash_hmac('sha256', $body, config_string('session_secret'), true));
    if (!hash_equals($expected, $signature)) {
        return null;
    }
    $json = b64url_decode($body);
    $payload = $json === false ? null : json_decode($json, true);
    if (!is_array($payload) || !isset($payload['exp']) || !is_int($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }
    return $payload;
}

/** Public host of this request, only if it is one of ours (never trust Host blindly). */
function request_host(): string
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $name = explode(':', $host)[0];
    if (!in_array($name, ALLOWED_HOSTS, true)) {
        respond(400, ['ok' => false, 'error' => 'host-not-allowed']);
    }
    return $host;
}

function request_scheme(): string
{
    $name = explode(':', request_host())[0];
    return $name === 'localhost' || $name === '127.0.0.1' ? 'http' : 'https';
}

/** Path of this API, e.g. "/api" or "/apps/mergeforge/api". */
function api_base(): string
{
    return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');
}

/** Path of the frontend that hosts this API, always ending in "/". */
function app_base(): string
{
    $parent = rtrim(str_replace('\\', '/', dirname(api_base())), '/');
    return $parent . '/';
}

function public_url(string $path): string
{
    return request_scheme() . '://' . request_host() . $path;
}

function set_cookie_value(string $name, string $value, int $ttlSeconds): void
{
    setcookie($name, $value, [
        'expires' => $ttlSeconds > 0 ? time() + $ttlSeconds : time() - 3600,
        'path' => api_base() === '' ? '/' : api_base(),
        'secure' => request_scheme() === 'https',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** State-changing requests must come from one of our own pages. */
function require_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $host = strtolower((string) parse_url($origin, PHP_URL_HOST));
    if (!in_array($host, ALLOWED_HOSTS, true)) {
        respond(403, ['ok' => false, 'error' => 'origin-not-allowed']);
    }
}
