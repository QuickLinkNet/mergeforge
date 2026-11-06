import {
  createFarSignals,
  type FarSignal,
  type GameState,
  type WorldSnapshot,
} from '@mergeforge/domain';
import {
  createSignalwerkPuzzle,
  isSignalwerkSolved,
  type SignalRotation,
} from '@mergeforge/signalwerk';
import { isCount, isRecord, parseTimestamp } from './guards';

export function parsePrologue(value: unknown): GameState['prologue'] | null {
  if (
    !isRecord(value) ||
    typeof value.stoneProductionObserved !== 'boolean' ||
    !isCount(value.pathfinderSurveysCompleted) ||
    !Array.isArray(value.completedChapterIds) ||
    !Array.isArray(value.eventIds)
  ) return null;

  const completedChapterIds = value.completedChapterIds;
  const eventIds = value.eventIds;
  if (
    completedChapterIds.some((chapter) => chapter !== 3 && chapter !== 4 && chapter !== 5 && chapter !== 6 && chapter !== 7) ||
    eventIds.some((eventId) =>
      eventId !== 'relay_discovered' &&
      eventId !== 'signalwerk_solved' &&
      eventId !== 'relay_repaired' &&
      eventId !== 'first_signals_received') ||
    new Set(completedChapterIds).size !== completedChapterIds.length ||
    new Set(eventIds).size !== eventIds.length
  ) return null;

  const completedSequence = completedChapterIds.join(',');
  if (!['', '3', '3,4', '3,4,5', '3,4,5,6', '3,4,5,6,7'].includes(completedSequence)) return null;
  const eventSequence = eventIds.join(',');
  if (!['', 'relay_discovered', 'relay_discovered,signalwerk_solved', 'relay_discovered,signalwerk_solved,relay_repaired', 'relay_discovered,signalwerk_solved,relay_repaired,first_signals_received'].includes(eventSequence)) {
    return null;
  }

  return {
    stoneProductionObserved: value.stoneProductionObserved,
    pathfinderSurveysCompleted: value.pathfinderSurveysCompleted,
    completedChapterIds: [...completedChapterIds] as (3 | 4 | 5 | 6 | 7)[],
    eventIds: [...eventIds] as GameState['prologue']['eventIds'][number][],
  };
}

export function parseSignalwerk(
  value: unknown,
  world: WorldSnapshot,
): GameState['signalwerk'] | null {
  const expectedSeed = `${world.seed}:signalwerk:${world.relaySite.tileKey}`;
  if (
    !isRecord(value) ||
    value.seed !== expectedSeed ||
    !Array.isArray(value.rotations) ||
    value.rotations.length !== 25 ||
    value.rotations.some((rotation) =>
      rotation !== 0 && rotation !== 1 && rotation !== 2 && rotation !== 3
    ) ||
    typeof value.solved !== 'boolean'
  ) return null;
  const rotations = [...value.rotations] as SignalRotation[];
  const puzzle = createSignalwerkPuzzle(expectedSeed);
  if (isSignalwerkSolved(puzzle, rotations) !== value.solved) return null;
  return { seed: expectedSeed, rotations, solved: value.solved };
}

export function parseInventory(value: unknown): GameState['inventory'] | null {
  if (!isRecord(value) || (value.resonanceCore !== 0 && value.resonanceCore !== 1)) return null;
  return { resonanceCore: value.resonanceCore };
}

export function parseSignals(value: unknown, world: WorldSnapshot): readonly FarSignal[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];
  // Signals are fully derived data: anything other than the exact regenerated
  // pair (including extra fields such as coordinates) is a manipulated save.
  const expected = createFarSignals(world.seed, world.generatorVersion);
  if (value.length !== expected.length) return null;
  for (const [index, entry] of value.entries()) {
    const reference = expected[index];
    if (
      reference === undefined ||
      !isRecord(entry) ||
      Object.keys(entry).sort().join(',') !== 'bearing,distanceBand,id' ||
      entry.id !== reference.id ||
      entry.bearing !== reference.bearing ||
      entry.distanceBand !== reference.distanceBand
    ) return null;
  }
  return expected;
}

export function parseRelay(value: unknown, migratingLegacy: boolean): GameState['relay'] | null {
  if (!isRecord(value) || typeof value.coreInstalled !== 'boolean') return null;
  if (value.status === 'dormant' && value.coreInstalled === false) {
    return { status: 'dormant', coreInstalled: false };
  }
  if ((value.status === 'repairing' || value.status === 'active') && value.coreInstalled === true) {
    const startedAtMs = parseTimestamp(value.startedAtMs);
    const completesAtMs = parseTimestamp(value.completesAtMs);
    if (startedAtMs === null || completesAtMs === null || completesAtMs < startedAtMs) return null;
    if (migratingLegacy && value.capabilities === undefined) {
      return { status: value.status, coreInstalled: true, startedAtMs, completesAtMs, capabilities: [] };
    }
    const capabilities = value.capabilities;
    if (
      !Array.isArray(capabilities) ||
      capabilities.some((capability) => capability !== 'signal_network_active') ||
      new Set(capabilities).size !== capabilities.length ||
      (capabilities.length > 0 && value.status !== 'active')
    ) return null;
    return {
      status: value.status,
      coreInstalled: true,
      startedAtMs,
      completesAtMs,
      capabilities: [...capabilities] as 'signal_network_active'[],
    };
  }
  return null;
}
