<?php

declare(strict_types=1);

// Access requests and owner decisions (D-019). People who are signed in with GitHub but
// are not contributors can ask to join; the owner approves or denies on the admin page.
// Statuses: pending | approved | denied. "denied" also locks out a registered player.

const ACCESS_MAX_PENDING = 100;

function access_status(int $githubUserId): ?string
{
    $find = db()->prepare('SELECT status FROM access WHERE github_user_id = ?');
    $find->execute([$githubUserId]);
    $status = $find->fetchColumn();
    return is_string($status) ? $status : null;
}

/**
 * Records a request. An existing decision is never overwritten by a new request.
 * @return string|null the status afterwards, null if the queue is full
 */
function request_access(int $githubUserId, string $githubLogin): ?string
{
    $existing = access_status($githubUserId);
    if ($existing !== null) {
        return $existing;
    }
    $pending = (int) db()->query("SELECT COUNT(*) FROM access WHERE status = 'pending'")->fetchColumn();
    if ($pending >= ACCESS_MAX_PENDING) {
        return null;
    }
    db()->prepare('INSERT OR IGNORE INTO access (github_user_id, github_login, status, created_at) VALUES (?, ?, ?, ?)')
        ->execute([$githubUserId, $githubLogin, 'pending', gmdate('c')]);
    return 'pending';
}

/** Sets the decision for a user (creates the row for invitations). */
function decide_access(int $githubUserId, string $githubLogin, string $status): void
{
    if (!in_array($status, ['approved', 'denied', 'pending'], true)) {
        throw new InvalidArgumentException('Unknown access status.');
    }
    db()->prepare(
        'INSERT INTO access (github_user_id, github_login, status, created_at, decided_at) VALUES (:id, :login, :status, :now, :now)
         ON CONFLICT(github_user_id) DO UPDATE SET status = :status, github_login = :login, decided_at = :now'
    )->execute(['id' => $githubUserId, 'login' => $githubLogin, 'status' => $status, 'now' => gmdate('c')]);
}

/** @return list<array<string,mixed>> */
function list_access(): array
{
    $rows = db()->query('SELECT github_user_id, github_login, status, created_at, decided_at FROM access ORDER BY created_at DESC')->fetchAll();
    return array_map(static fn (array $row): array => [
        'githubUserId' => (int) $row['github_user_id'],
        'githubLogin' => $row['github_login'],
        'status' => $row['status'],
        'createdAt' => $row['created_at'],
        'decidedAt' => $row['decided_at'],
    ], $rows);
}

/** @return list<array<string,mixed>> */
function list_players(): array
{
    $rows = db()->query('SELECT player_id, github_user_id, github_login, sector_index, created_at FROM players ORDER BY sector_index')->fetchAll();
    return array_map(static fn (array $row): array => [
        'githubUserId' => (int) $row['github_user_id'],
        'githubLogin' => $row['github_login'],
        'sectorIndex' => (int) $row['sector_index'],
        'createdAt' => $row['created_at'],
    ], $rows);
}

/** Looks up a public GitHub account by login for invitations. @return array{id:int,login:string}|null */
function github_user_by_login(string $login): ?array
{
    if (preg_match('/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/', $login) !== 1) {
        return null;
    }
    $user = github_http('GET', 'https://api.github.com/users/' . rawurlencode($login), []);
    if (!is_array($user) || !is_int($user['id'] ?? null) || !is_string($user['login'] ?? null)) {
        return null;
    }
    return ['id' => $user['id'], 'login' => $user['login']];
}

function is_owner_session(?array $session): bool
{
    return $session !== null && ($session['gid'] ?? null) === OWNER_GITHUB_USER_ID;
}
