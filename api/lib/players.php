<?php

declare(strict_types=1);

// Player registry (D-002/D-014), PHP twin of packages/domain/src/players.ts.
// api/tests/run.php pins sectorForIndex to the same values as the TypeScript tests.

const SECTOR_DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Ring 0 is the origin, ring k holds 6k sectors. @return array{q:int,r:int} */
function sector_for_index(int $index): array
{
    if ($index < 0) {
        throw new RangeException('Sector index must be non-negative.');
    }
    if ($index === 0) {
        return ['q' => 0, 'r' => 0];
    }
    $ring = 1;
    $remaining = $index - 1;
    while ($remaining >= 6 * $ring) {
        $remaining -= 6 * $ring;
        $ring++;
    }
    $q = -$ring;
    $r = $ring;
    $side = intdiv($remaining, $ring);
    for ($walked = 0; $walked < $side; $walked++) {
        $q += SECTOR_DIRECTIONS[$walked][0] * $ring;
        $r += SECTOR_DIRECTIONS[$walked][1] * $ring;
    }
    $step = $remaining % $ring;
    return ['q' => $q + SECTOR_DIRECTIONS[$side][0] * $step, 'r' => $r + SECTOR_DIRECTIONS[$side][1] * $step];
}

function new_player_id(): string
{
    return 'mf_' . bin2hex(random_bytes(16));
}

function storage_available(): bool
{
    return in_array('sqlite', PDO::getAvailableDrivers(), true);
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    if (!storage_available()) {
        respond(503, ['ok' => false, 'error' => 'storage-unavailable']);
    }
    $dir = config_string('data_dir') !== '' ? config_string('data_dir') : __DIR__ . '/../data';
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    $guard = $dir . '/.htaccess';
    if (!is_file($guard)) {
        file_put_contents($guard, "Require all denied\n");
    }
    $pdo = new PDO('sqlite:' . $dir . '/mergeforge.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id TEXT NOT NULL UNIQUE,
            github_user_id INTEGER NOT NULL UNIQUE,
            github_login TEXT NOT NULL,
            sector_index INTEGER NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )'
    );
    return $pdo;
}

/** @return array<string,mixed> */
function player_view(array $row): array
{
    return [
        'playerId' => $row['player_id'],
        'githubLogin' => $row['github_login'],
        'sectorIndex' => (int) $row['sector_index'],
        'sector' => sector_for_index((int) $row['sector_index']),
    ];
}

/** Finds the player of a GitHub user or registers a new one in the next free sector. */
function register_player(int $githubUserId, string $githubLogin): array
{
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $find = $pdo->prepare('SELECT * FROM players WHERE github_user_id = ?');
        $find->execute([$githubUserId]);
        $row = $find->fetch();
        if ($row !== false) {
            if ($row['github_login'] !== $githubLogin) {
                $pdo->prepare('UPDATE players SET github_login = ? WHERE github_user_id = ?')
                    ->execute([$githubLogin, $githubUserId]);
                $row['github_login'] = $githubLogin;
            }
        } else {
            $next = (int) $pdo->query('SELECT COALESCE(MAX(sector_index) + 1, 0) FROM players')->fetchColumn();
            $row = [
                'player_id' => new_player_id(),
                'github_user_id' => $githubUserId,
                'github_login' => $githubLogin,
                'sector_index' => $next,
                'created_at' => gmdate('c'),
            ];
            $pdo->prepare(
                'INSERT INTO players (player_id, github_user_id, github_login, sector_index, created_at)
                 VALUES (:player_id, :github_user_id, :github_login, :sector_index, :created_at)'
            )->execute($row);
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $error) {
        $pdo->exec('ROLLBACK');
        throw $error;
    }
    return player_view($row);
}

function find_player(string $playerId): ?array
{
    $find = db()->prepare('SELECT * FROM players WHERE player_id = ?');
    $find->execute([$playerId]);
    $row = $find->fetch();
    return $row === false ? null : player_view($row);
}
