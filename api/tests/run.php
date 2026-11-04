<?php

declare(strict_types=1);

// Run: php api/tests/run.php   (pure PHP, no framework; not uploaded by the deploy)
// Keeps the PHP sector spiral identical to packages/domain/src/players.ts.

require __DIR__ . '/../lib/util.php';
require __DIR__ . '/../lib/players.php';
require __DIR__ . '/../lib/saves.php';

$failures = 0;
function check(bool $condition, string $label): void
{
    global $failures;
    echo ($condition ? 'ok   ' : 'FAIL ') . $label . PHP_EOL;
    if (!$condition) {
        $failures++;
    }
}

// Reference values computed from sectorForIndex in the TypeScript domain.
$expected = [[0,0],[-1,1],[0,1],[1,0],[1,-1],[0,-1],[-1,0],[-2,2],[-1,2],[0,2],[1,1],[2,0],[2,-1],[2,-2],[1,-2],[0,-2],[-1,-1],[-2,0],[-2,1],[-3,3]];
foreach ($expected as $index => [$q, $r]) {
    $sector = sector_for_index($index);
    check($sector['q'] === $q && $sector['r'] === $r, "sector $index = ($q,$r)");
}

$unique = [];
for ($index = 0; $index < 37; $index++) {
    $sector = sector_for_index($index);
    $unique[$sector['q'] . ',' . $sector['r']] = true;
}
check(count($unique) === 37, '37 sectors are all distinct');
check(preg_match('/^mf_[0-9a-f]{32}$/', new_player_id()) === 1, 'player id format');

// Signed tokens: round trip, tampering, expiry.
$dataDir = sys_get_temp_dir() . '/mf-test-' . bin2hex(random_bytes(4));
$GLOBALS['mf_config_override'] = ['session_secret' => str_repeat('s', 40), 'data_dir' => $dataDir];
check(b64url_decode(b64url_encode('hello world')) === 'hello world', 'base64url round trip');
$token = sign_token(['pid' => 'x'], 60);
check((verify_token($token)['pid'] ?? null) === 'x', 'token verifies');
check(verify_token($token . 'a') === null, 'tampered signature rejected');
check(verify_token('abc') === null && verify_token(null) === null, 'malformed token rejected');
check(verify_token(sign_token(['pid' => 'x'], -5)) === null, 'expired token rejected');
$GLOBALS['mf_config_override']['session_secret'] = str_repeat('t', 40);
check(verify_token($token) === null, 'token from another secret rejected');
$GLOBALS['mf_config_override']['session_secret'] = str_repeat('s', 40);

// Registry on a throwaway SQLite database.
if (storage_available()) {
    $a = register_player(101, 'alice');
    $b = register_player(202, 'bob');
    check($a['sector'] !== $b['sector'] && $a['sectorIndex'] === 0 && $b['sectorIndex'] === 1, 'two players get separate sectors');
    $again = register_player(101, 'alice');
    check($again['playerId'] === $a['playerId'] && $again['sectorIndex'] === 0, 'same GitHub user keeps ID and sector');
    $renamed = register_player(101, 'alice-new');
    check($renamed['playerId'] === $a['playerId'] && $renamed['githubLogin'] === 'alice-new', 'login rename keeps ID');
    check(find_player($b['playerId'])['githubLogin'] === 'bob', 'find_player');
    check(find_player('mf_' . str_repeat('0', 32)) === null, 'unknown player is null');

    // Saves: optimistic revisions.
    $good = json_encode(['formatVersion' => 1, 'gameSchemaVersion' => 7, 'world' => ['seed' => 's'], 'empty' => new stdClass()]);
    check(save_payload_error(json_decode($good, true)) === null, 'plausible save accepted');
    check(save_payload_error([1, 2]) !== null && save_payload_error('x') !== null, 'non-object save rejected');
    check(save_payload_error(['formatVersion' => 2, 'gameSchemaVersion' => 7, 'world' => ['seed' => 's']]) !== null, 'wrong format rejected');
    check(save_payload_error(['formatVersion' => 1, 'gameSchemaVersion' => 7, 'world' => ['seed' => '']]) !== null, 'empty world seed rejected');
    check(load_save($a['playerId'], true) === null, 'no save yet');
    $first = store_save($a['playerId'], 0, $good);
    check($first['ok'] === true && $first['revision'] === 1, 'first save is revision 1');
    $second = store_save($a['playerId'], 1, $good);
    check($second['ok'] === true && $second['revision'] === 2, 'second save is revision 2');
    $stale = store_save($a['playerId'], 1, $good);
    check($stale['ok'] === false && $stale['revision'] === 2, 'stale base revision conflicts');
    check(store_save($a['playerId'], 0, $good)['ok'] === false, 'revision 0 conflicts once a save exists');
    $loaded = load_save($a['playerId'], true);
    check($loaded['payload'] === $good && $loaded['revision'] === 2, 'payload is stored byte for byte');
    check(!isset(load_save($a['playerId'], false)['payload']), 'meta load omits the payload');
    check(load_save($b['playerId'], true) === null, 'saves are per player');
} else {
    echo "skip registry tests (pdo_sqlite missing)\n";
}

// Playing is for contributors only (D-018).
$GLOBALS['mf_config_override'] = ['session_secret' => str_repeat('s', 40), 'allowed_github_user_ids' => [777, 'x']];
check(may_play(OWNER_GITHUB_USER_ID, false, false), 'owner may always play');
check(may_play(777, false, false), 'explicitly allowed tester may play');
check(!may_play(888, false, false), 'stranger without merged PR may not play');
check(!may_play(888, false, null), 'nobody new gets in when GitHub cannot answer');
check(may_play(888, false, true), 'contributor with a merged PR may play');
check(may_play(888, true, null), 'known players keep access when GitHub is down');
check(allowed_github_user_ids() === [777], 'non-integer allowlist entries are ignored');

echo $failures === 0 ? "All passed\n" : "$failures failed\n";
exit($failures === 0 ? 0 : 1);
