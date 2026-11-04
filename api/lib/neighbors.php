<?php
declare(strict_types=1);

// "Funkkontakte": the real neighbours of a player, as coarse compass bearing and distance band only.
// Never an exact coordinate, never terrain: it mirrors the far-signal contract of chapter 7.

/** Same order as SIGNAL_BEARINGS in packages/domain/src/signals.ts (and SECTOR_DIRECTIONS). */
const CONTACT_BEARINGS = ['east', 'north-east', 'north-west', 'west', 'south-west', 'south-east'];
const CONTACT_LIMIT = 3;

/** Hex distance between two axial sector coordinates. */
function sector_distance(array $a, array $b): int
{
    $dq = $b['q'] - $a['q'];
    $dr = $b['r'] - $a['r'];
    return (int) ((abs($dq) + abs($dr) + abs($dq + $dr)) / 2);
}

/** Compass bearing from one sector towards another (pointy-top axial layout, north up). */
function sector_bearing(array $from, array $to): string
{
    $dq = $to['q'] - $from['q'];
    $dr = $to['r'] - $from['r'];
    $x = sqrt(3) * ($dq + $dr / 2);
    $y = 1.5 * $dr;
    $degrees = rad2deg(atan2(-$y, $x));
    if ($degrees < 0) {
        $degrees += 360;
    }
    return CONTACT_BEARINGS[(int) floor(($degrees + 30) / 60) % 6];
}

/** Coarse distance class by sector distance: 1 near, 2 middle, 3 and more far. */
function contact_band(int $sectors): string
{
    return $sectors <= 1 ? 'near' : ($sectors === 2 ? 'middle' : 'far');
}

/**
 * The nearest other players. Locked-out players are not listed.
 * @param array{q:int,r:int} $mySector
 * @param list<array{githubUserId:int,githubLogin:string,sectorIndex:int}> $players
 * @param callable(int):?string $statusOf access status of a GitHub user ID
 * @return list<array{githubUserId:int,contact:array{login:string,bearing:string,distanceBand:string}}>
 */
function neighbor_entries(array $mySector, int $myIndex, array $players, callable $statusOf): array
{
    $found = [];
    foreach ($players as $other) {
        if ($other['sectorIndex'] === $myIndex || $statusOf($other['githubUserId']) === 'denied') {
            continue;
        }
        $sector = sector_for_index($other['sectorIndex']);
        $found[] = [
            'distance' => sector_distance($mySector, $sector),
            'index' => $other['sectorIndex'],
            'githubUserId' => $other['githubUserId'],
            'contact' => [
                'login' => $other['githubLogin'],
                'bearing' => sector_bearing($mySector, $sector),
                'distanceBand' => contact_band(sector_distance($mySector, $sector)),
            ],
        ];
    }
    usort($found, static fn (array $a, array $b): int => [$a['distance'], $a['index']] <=> [$b['distance'], $b['index']]);
    return array_map(
        static fn (array $row): array => ['githubUserId' => $row['githubUserId'], 'contact' => $row['contact']],
        array_slice($found, 0, CONTACT_LIMIT)
    );
}

/**
 * Same as neighbor_entries, but only what may leave the server.
 * @return list<array{login:string,bearing:string,distanceBand:string}>
 */
function neighbor_contacts(array $mySector, int $myIndex, array $players, callable $statusOf): array
{
    return array_map(
        static fn (array $entry): array => $entry['contact'],
        neighbor_entries($mySector, $myIndex, $players, $statusOf)
    );
}
