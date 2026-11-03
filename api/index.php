<?php

declare(strict_types=1);

// Single entry point of the MERGEFORGE API (see .htaccess).
// Live at https://mergeforge.red-it.org/api. Secrets belong in
// config.local.php on the server, never in Git (see api/config.example.php).

const API_VERSION = '0.1.0';

function respond(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && preg_match('#^https://mergeforge\.red-it\.org$|^http://(localhost|127\.0\.0\.1):\d+$#', $origin) === 1) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Path relative to this folder, e.g. "/health".
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$path = '/' . trim(substr((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), strlen($base)), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($path === '/health' && $method === 'GET') {
    respond(200, [
        'ok' => true,
        'service' => 'mergeforge-api',
        'version' => API_VERSION,
        'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
        'time' => gmdate('c'),
    ]);
}

respond(404, ['ok' => false, 'error' => 'not-found']);
