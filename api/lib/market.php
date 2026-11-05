<?php
declare(strict_types=1);

// Trade offers between neighbouring players (D-021).
//
// The save stays client-authoritative, but the server checks every new offer against the stock in the
// player's last uploaded save (minus offers posted since that upload), so goods cannot be invented from
// nothing. Offers are visible to the poster's neighbours, a trade is settled exactly once (atomically),
// and the goods travel through a per-player inbox that is claimed once.

const MARKET_RESOURCES = ['wood', 'stone'];
const MARKET_MAX_AMOUNT = 50;
const MARKET_MAX_OPEN_OFFERS = 3;

/** Overview for one player: offers of its neighbours, its own open offers and unclaimed deliveries. */
function market_overview(int $gid, array $contactIds): array
{
    $pdo = db();
    $offers = [];
    if ($contactIds !== []) {
        $marks = implode(',', array_fill(0, count($contactIds), '?'));
        $query = $pdo->prepare("SELECT * FROM offers WHERE status = 'open' AND seller_gid IN ($marks) ORDER BY id DESC LIMIT 30");
        $query->execute($contactIds);
        $offers = array_map('offer_view', $query->fetchAll());
    }
    $mine = $pdo->prepare("SELECT * FROM offers WHERE status = 'open' AND seller_gid = ? ORDER BY id DESC");
    $mine->execute([$gid]);
    $inbox = $pdo->prepare('SELECT id, resource, amount, reason, counterpart FROM inbox WHERE owner_gid = ? AND claimed = 0 ORDER BY id LIMIT 50');
    $inbox->execute([$gid]);
    return [
        'offers' => $offers,
        'mine' => array_map('offer_view', $mine->fetchAll()),
        'inbox' => array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'resource' => $row['resource'],
            'amount' => (int) $row['amount'],
            'reason' => $row['reason'],
            'counterpart' => $row['counterpart'],
        ], $inbox->fetchAll()),
    ];
}

/** @return array<string,mixed> */
function offer_view(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'seller' => $row['seller_login'],
        'giveResource' => $row['give_resource'],
        'giveAmount' => (int) $row['give_amount'],
        'wantResource' => $row['want_resource'],
        'wantAmount' => (int) $row['want_amount'],
    ];
}

function valid_trade_amount(mixed $value): bool
{
    return is_int($value) && $value >= 1 && $value <= MARKET_MAX_AMOUNT;
}

/**
 * @param array{wood:int,stone:int,since:string} $stock stock of the last uploaded save and its upload time
 * @return array<string,mixed> error => code, or id => new offer id
 */
function create_offer(int $gid, string $login, array $request, array $stock = ['wood' => 0, 'stone' => 0, 'since' => '']): array
{
    $give = $request['giveResource'] ?? null;
    $want = $request['wantResource'] ?? null;
    if (
        !in_array($give, MARKET_RESOURCES, true) || !in_array($want, MARKET_RESOURCES, true) || $give === $want
        || !valid_trade_amount($request['giveAmount'] ?? null) || !valid_trade_amount($request['wantAmount'] ?? null)
    ) {
        return ['error' => 'invalid-offer'];
    }
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $count = $pdo->prepare("SELECT COUNT(*) FROM offers WHERE status = 'open' AND seller_gid = ?");
        $count->execute([$gid]);
        if ((int) $count->fetchColumn() >= MARKET_MAX_OPEN_OFFERS) {
            $pdo->exec('ROLLBACK');
            return ['error' => 'too-many-offers'];
        }
        // Goods already promised in offers posted after the last upload are not in the saved stock yet.
        $reserved = $pdo->prepare("SELECT COALESCE(SUM(give_amount), 0) FROM offers WHERE status = 'open' AND seller_gid = ? AND give_resource = ? AND created_at > ?");
        $reserved->execute([$gid, $give, $stock['since']]);
        if ((int) $stock[$give] - (int) $reserved->fetchColumn() < $request['giveAmount']) {
            $pdo->exec('ROLLBACK');
            return ['error' => 'not-enough-stock'];
        }
        $insert = $pdo->prepare(
            "INSERT INTO offers (seller_gid, seller_login, give_resource, give_amount, want_resource, want_amount, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'open', ?)"
        );
        $insert->execute([$gid, $login, $give, $request['giveAmount'], $want, $request['wantAmount'], gmdate('c')]);
        $id = (int) $pdo->lastInsertId();
        $pdo->exec('COMMIT');
        return ['id' => $id];
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
}

/**
 * Settles an offer exactly once. The buyer receives the offered goods and the seller the wanted goods,
 * both through their inboxes. @return array<string,mixed>
 */
function accept_offer(int $gid, array $contactIds, array $request): array
{
    $id = $request['offerId'] ?? null;
    if (!is_int($id) || $id < 1) {
        return ['error' => 'invalid-offer'];
    }
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $find = $pdo->prepare("SELECT * FROM offers WHERE id = ? AND status = 'open'");
        $find->execute([$id]);
        $offer = $find->fetch();
        if (!is_array($offer) || (int) $offer['seller_gid'] === $gid || !in_array((int) $offer['seller_gid'], $contactIds, true)) {
            $pdo->exec('ROLLBACK');
            return ['error' => 'not-found'];
        }
        $now = gmdate('c');
        $pdo->prepare("UPDATE offers SET status = 'taken', buyer_gid = ?, closed_at = ? WHERE id = ?")->execute([$gid, $now, $id]);
        $buyer = $pdo->prepare('SELECT github_login FROM players WHERE github_user_id = ?');
        $buyer->execute([$gid]);
        $buyerLogin = (string) ($buyer->fetchColumn() ?: '');
        $put = $pdo->prepare('INSERT INTO inbox (owner_gid, resource, amount, reason, counterpart, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        $put->execute([$gid, $offer['give_resource'], $offer['give_amount'], 'purchase', $offer['seller_login'], $now]);
        $put->execute([(int) $offer['seller_gid'], $offer['want_resource'], $offer['want_amount'], 'sale', $buyerLogin, $now]);
        $pdo->exec('COMMIT');
        return [
            'giveResource' => $offer['give_resource'],
            'giveAmount' => (int) $offer['give_amount'],
            'wantResource' => $offer['want_resource'],
            'wantAmount' => (int) $offer['want_amount'],
        ];
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
}

/** Withdraws an own open offer; the reserved goods come back through the inbox. @return array<string,mixed> */
function cancel_offer(int $gid, array $request): array
{
    $id = $request['offerId'] ?? null;
    if (!is_int($id) || $id < 1) {
        return ['error' => 'invalid-offer'];
    }
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $find = $pdo->prepare("SELECT * FROM offers WHERE id = ? AND status = 'open' AND seller_gid = ?");
        $find->execute([$id, $gid]);
        $offer = $find->fetch();
        if (!is_array($offer)) {
            $pdo->exec('ROLLBACK');
            return ['error' => 'not-found'];
        }
        $now = gmdate('c');
        $pdo->prepare("UPDATE offers SET status = 'cancelled', closed_at = ? WHERE id = ?")->execute([$now, $id]);
        $pdo->prepare('INSERT INTO inbox (owner_gid, resource, amount, reason, counterpart, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$gid, $offer['give_resource'], $offer['give_amount'], 'refund', '', $now]);
        $pdo->exec('COMMIT');
        return [];
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
}

/** Marks the named own deliveries as claimed (once) and returns them. @return array<string,mixed> */
function claim_inbox(int $gid, array $request): array
{
    $ids = $request['ids'] ?? null;
    if (!is_array($ids) || count($ids) > 50 || array_filter($ids, static fn ($id): bool => !is_int($id) || $id < 1) !== []) {
        return ['error' => 'invalid-claim'];
    }
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $claimed = [];
        $find = $pdo->prepare('SELECT id, resource, amount FROM inbox WHERE id = ? AND owner_gid = ? AND claimed = 0');
        $mark = $pdo->prepare('UPDATE inbox SET claimed = 1 WHERE id = ?');
        foreach (array_unique($ids) as $id) {
            $find->execute([$id, $gid]);
            $row = $find->fetch();
            if (is_array($row)) {
                $mark->execute([$id]);
                $claimed[] = ['id' => (int) $row['id'], 'resource' => $row['resource'], 'amount' => (int) $row['amount']];
            }
        }
        $pdo->exec('COMMIT');
        return ['claimed' => $claimed];
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
}
