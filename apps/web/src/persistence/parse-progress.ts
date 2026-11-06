import {
  createFarSignals,
  type FarSignal,
  type GameState,
  type PrologueChapterId,
  type PrologueEventId,
  type WorldSnapshot,
} from '@mergeforge/domain';
import {
  createSignalwerkPuzzle,
  isSignalwerkSolved,
  type SignalRotation,
} from '@mergeforge/signalwerk';
import { isCount, isRecord, parseTimestamp } from './guards';

const CHAPTER_ORDER: readonly unknown[] = [3, 4, 5, 6, 7, 8] satisfies readonly PrologueChapterId[];
const EVENT_ORDER: readonly unknown[] = [
  'relay_discovered',
  'signalwerk_solved',
  'relay_repaired',
  'first_signals_received',
  'founders_works_completed',
] satisfies readonly PrologueEventId[];

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
    completedChapterIds.some((chapter) => !CHAPTER_ORDER.includes(chapter)) ||
    eventIds.some((eventId) => !EVENT_ORDER.includes(eventId)) ||
    new Set(completedChapterIds).size !== completedChapterIds.length ||
    new Set(eventIds).size !== eventIds.length
  ) return null;

  // Chapters and events are only ever appended in their fixed order.
  if (completedChapterIds.some((chapter, index) => chapter !== CHAPTER_ORDER[index])) return null;
  if (eventIds.some((eventId, index) => eventId !== EVENT_ORDER[index])) return null;

  return {
    stoneProductionObserved: value.stoneProductionObserved,
    pathfinderSurveysCompleted: value.pathfinderSurveysCompleted,
    completedChapterIds: [...completedChapterIds] as PrologueChapterId[],
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
