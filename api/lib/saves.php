<?php

declare(strict_types=1);

// One save per player with an optimistic revision counter (D-017).
// The server stores the client's save as opaque JSON: it checks shape, size and that
// the save belongs to the player's own sector world, not the game rules itself.

const SAVE_MAX_BYTES = 1048576;

function saves_table(): PDO
{
    $pdo = db();
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS saves (
            player_id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )'
    );
    return $pdo;
}

/** @return array{revision:int,updatedAt:string,payload?:string}|null */
function load_save(string $playerId, bool $withPayload): ?array
{
    $find = saves_table()->prepare('SELECT revision, payload, updated_at FROM saves WHERE player_id = ?');
    $find->execute([$playerId]);
    $row = $find->fetch();
    if ($row === false) {
        return null;
    }
    $save = ['revision' => (int) $row['revision'], 'updatedAt' => $row['updated_at']];
    if ($withPayload) {
        $save['payload'] = $row['payload'];
    }
    return $save;
}

/** Seed of the world in a player's sector: PHP twin of worldSeedForSector in apps/web/src/online.ts. */
function world_seed_for_sector(array $sector): string
{
    return $sector['q'] === 0 && $sector['r'] === 0
        ? UNIVERSE_SEED
        : UNIVERSE_SEED . '|sector|' . $sector['q'] . ',' . $sector['r'];
}

/** True for a JSON list (or empty array), false for an object or scalar. */
function is_json_list(mixed $value): bool
{
    return is_array($value) && ($value === [] || array_keys($value) === range(0, count($value) - 1));
}

/**
 * Plausibility check of an uploaded save; returns an error code or null.
 * With $expectedSeed the save must belong to exactly that world (a player's own sector).
 */
function save_payload_error(mixed $payload, ?string $expectedSeed = null): ?string
{
    if (!is_array($payload) || ($payload !== [] && array_keys($payload) === range(0, count($payload) - 1))) {
        return 'invalid-save';
    }
    if (($payload['formatVersion'] ?? null) !== 1 || !is_int($payload['gameSchemaVersion'] ?? null)) {
        return 'invalid-save';
    }
    $world = $payload['world'] ?? null;
    if (!is_array($world) || !is_string($world['seed'] ?? null) || $world['seed'] === '' || strlen($world['seed']) > 200) {
        return 'invalid-save';
    }
    if ($expectedSeed !== null && $world['seed'] !== $expectedSeed) {
        return 'wrong-world';
    }
    if ($payload['gameSchemaVersion'] < 1 || $payload['gameSchemaVersion'] > 1000) {
        return 'invalid-save';
    }
    foreach (['roadTileKeys', 'visibleTileKeys', 'buildings', 'units'] as $listKey) {
        if (array_key_exists($listKey, $payload) && !is_json_list($payload[$listKey])) {
            return 'invalid-save';
        }
    }
    if (array_key_exists('resources', $payload) && (!is_array($payload['resources']) || is_json_list($payload['resources']) && $payload['resources'] !== [])) {
        return 'invalid-save';
    }
    if (array_key_exists('lastAdvancedAtMs', $payload) && !(is_int($payload['lastAdvancedAtMs']) || is_float($payload['lastAdvancedAtMs']))) {
        return 'invalid-save';
    }
    return null;
}

/**
 * Stores a save if the client's base revision is still current.
 * @return array{ok:true,revision:int,updatedAt:string}|array{ok:false,revision:int}
 */
function store_save(string $playerId, int $baseRevision, string $payloadJson): array
{
    $pdo = saves_table();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $find = $pdo->prepare('SELECT revision FROM saves WHERE player_id = ?');
        $find->execute([$playerId]);
        $current = $find->fetchColumn();
        $currentRevision = $current === false ? 0 : (int) $current;
        if ($currentRevision !== $baseRevision) {
            $pdo->exec('ROLLBACK');
            return ['ok' => false, 'revision' => $currentRevision];
        }
        $next = $currentRevision + 1;
        $now = gmdate('c');
        $pdo->prepare(
            'INSERT INTO saves (player_id, revision, payload, updated_at) VALUES (:p, :r, :j, :t)
             ON CONFLICT(player_id) DO UPDATE SET revision = :r, payload = :j, updated_at = :t'
        )->execute([':p' => $playerId, ':r' => $next, ':j' => $payloadJson, ':t' => $now]);
        $pdo->exec('COMMIT');
        return ['ok' => true, 'revision' => $next, 'updatedAt' => $now];
    } catch (Throwable $error) {
        $pdo->exec('ROLLBACK');
        throw $error;
    }
}
