import {
  isValidModuleRef,
  MODULE_MAX_PRODUCTION_PER_PULSE,
  type Building,
  type ModuleRef,
  type Unit,
} from '@mergeforge/domain';
import { isCount, isRecord, parseTimestamp } from './guards';
import type { TileByKey } from './schema';

export function parseBuildings(
  value: unknown,
  tileByKey: TileByKey,
  stoneSiteKeys: ReadonlySet<string>,
  villageTileKey: string,
  /** False for saves before schema 8: they cannot contain a storehouse or an upgrade yet. */
  allowSinks = true,
): readonly Building[] | null {
  if (!Array.isArray(value)) return null;
  const buildings: Building[] = [];
  const ids = new Set<string>();
  const tileKeys = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const isSink = SINK_TYPES.includes(candidate.type);
    const isVillageBuilding = candidate.type === 'survey-tent' || candidate.type === 'workshop' || isSink;
    const startedAtMs = parseTimestamp(candidate.startedAtMs);
    const completesAtMs = parseTimestamp(candidate.completesAtMs);
    if (
      typeof candidate.id !== 'string' ||
      (isSink && !allowSinks) ||
      (candidate.type !== 'lumber-camp' && candidate.type !== 'quarry' && candidate.type !== 'survey-tent' && candidate.type !== 'workshop' && candidate.type !== 'module' && !isSink) ||
      typeof candidate.tileKey !== 'string' ||
      (candidate.status !== 'constructing' && candidate.status !== 'active') ||
      startedAtMs === null ||
      completesAtMs === null ||
      ids.has(candidate.id) ||
      (!isVillageBuilding && tileKeys.has(candidate.tileKey)) ||
      (isVillageBuilding && buildings.some((building) => building.type === candidate.type))
    ) {
      return null;
    }
    const tile = tileByKey.get(candidate.tileKey);
    if (
      tile === undefined ||
      completesAtMs < startedAtMs ||
      (candidate.type === 'lumber-camp' && tile.terrain !== 'forest') ||
      (candidate.type === 'quarry' && !stoneSiteKeys.has(candidate.tileKey)) ||
      (isVillageBuilding && candidate.tileKey !== villageTileKey)
    ) {
      return null;
    }

    ids.add(candidate.id);
    if (!isVillageBuilding) tileKeys.add(candidate.tileKey);
    if (isSink) {
      const sink = parseSinkBuilding(candidate, startedAtMs, completesAtMs);
      if (sink === null) return null;
      buildings.push(sink);
      continue;
    }
    if (candidate.type === 'module') {
      const moduleBuilding = parseModuleBuilding(candidate, startedAtMs, completesAtMs);
      if (moduleBuilding === null) return null;
      buildings.push(moduleBuilding);
      continue;
    }
    if (candidate.type === 'survey-tent' || candidate.type === 'workshop') {
      buildings.push({
        id: candidate.id,
        type: candidate.type,
        tileKey: candidate.tileKey,
        status: candidate.status,
        startedAtMs,
        completesAtMs,
      });
    } else {
      const lastProductionAtMs = parseTimestamp(candidate.lastProductionAtMs);
      if (lastProductionAtMs === null) return null;
      if (candidate.type !== 'lumber-camp' && candidate.type !== 'quarry') return null;
      buildings.push({
        id: candidate.id,
        type: candidate.type,
        tileKey: candidate.tileKey,
        status: candidate.status,
        startedAtMs,
        completesAtMs,
        lastProductionAtMs,
      });
    }
  }
  return buildings;
}

export function parseUnits(
  value: unknown,
  tileByKey: TileByKey,
  roadTileKeys: ReadonlySet<string>,
  villageTileKey: string,
  maxCharges: number,
): readonly Unit[] | null {
  if (!Array.isArray(value) || value.length > 1) return null;
  const units: Unit[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const startedAtMs = parseTimestamp(candidate.startedAtMs);
    const completesAtMs = parseTimestamp(candidate.completesAtMs);
    const lastChargeAtMs = parseTimestamp(candidate.lastChargeAtMs);
    if (
      typeof candidate.id !== 'string' ||
      candidate.type !== 'pathfinder' ||
      (candidate.status !== 'training' && candidate.status !== 'active') ||
      typeof candidate.tileKey !== 'string' ||
      !tileByKey.has(candidate.tileKey) ||
      !isCount(candidate.charges) ||
      candidate.charges > maxCharges ||
      startedAtMs === null ||
      completesAtMs === null ||
      lastChargeAtMs === null ||
      completesAtMs < startedAtMs ||
      (candidate.status === 'training' && candidate.tileKey !== villageTileKey) ||
      (candidate.status === 'active' && candidate.tileKey !== villageTileKey && !roadTileKeys.has(candidate.tileKey))
    ) return null;
    units.push({
      id: candidate.id,
      type: 'pathfinder',
      status: candidate.status,
      tileKey: candidate.tileKey,
      charges: candidate.charges,
      startedAtMs,
      completesAtMs,
      lastChargeAtMs,
    });
  }
  return units;
}

const SINK_TYPES: readonly unknown[] = ['storehouse', 'lumber-upgrade', 'quarry-upgrade'];
const STOREHOUSE_KEYS = 'completesAtMs,id,level,startedAtMs,status,tileKey,type';
const UPGRADE_KEYS = 'completesAtMs,id,startedAtMs,status,tileKey,type';

/** Storehouse or production upgrade (schema 8): exact fields, fixed id, level 1..3. */
function parseSinkBuilding(
  candidate: Record<string, unknown>,
  startedAtMs: number,
  completesAtMs: number,
): Building | null {
  const { id, tileKey, status } = candidate;
  if (
    typeof tileKey !== 'string' ||
    id !== `${String(candidate.type)}:${tileKey}` ||
    (status !== 'constructing' && status !== 'active')
  ) return null;
  const keys = Object.keys(candidate).sort().join(',');
  if (candidate.type === 'storehouse') {
    const { level } = candidate;
    if (keys !== STOREHOUSE_KEYS || (level !== 1 && level !== 2 && level !== 3)) return null;
    return { id, type: 'storehouse', tileKey, status, level, startedAtMs, completesAtMs };
  }
  if (keys !== UPGRADE_KEYS) return null;
  if (candidate.type !== 'lumber-upgrade' && candidate.type !== 'quarry-upgrade') return null;
  return { id, type: candidate.type, tileKey, status, startedAtMs, completesAtMs };
}

const MODULE_BUILDING_KEYS = [
  'completesAtMs',
  'id',
  'lastProductionAtMs',
  'moduleId',
  'moduleVersion',
  'production',
  'startedAtMs',
  'status',
  'tileKey',
  'type',
].join(',');

function parseModuleBuilding(
  candidate: Record<string, unknown>,
  startedAtMs: number | null,
  completesAtMs: number | null,
): Building | null {
  const lastProductionAtMs = parseTimestamp(candidate.lastProductionAtMs);
  const { moduleId, moduleVersion, production } = candidate;
  if (
    startedAtMs === null ||
    completesAtMs === null ||
    lastProductionAtMs === null ||
    Object.keys(candidate).sort().join(',') !== MODULE_BUILDING_KEYS ||
    typeof moduleId !== 'string' ||
    typeof moduleVersion !== 'string' ||
    !isValidModuleRef({ id: moduleId, version: moduleVersion }) ||
    typeof candidate.tileKey !== 'string' ||
    candidate.id !== `module:${moduleId}:${candidate.tileKey}` ||
    (candidate.status !== 'constructing' && candidate.status !== 'active') ||
    !isRecord(production) ||
    Object.keys(production).sort().join(',') !== 'amountPerPulse,resource' ||
    (production.resource !== 'wood' && production.resource !== 'stone') ||
    typeof production.amountPerPulse !== 'number' ||
    !Number.isInteger(production.amountPerPulse) ||
    production.amountPerPulse < 1 ||
    production.amountPerPulse > MODULE_MAX_PRODUCTION_PER_PULSE
  ) return null;
  return {
    id: candidate.id as string,
    type: 'module',
    moduleId,
    moduleVersion,
    tileKey: candidate.tileKey,
    status: candidate.status,
    startedAtMs,
    completesAtMs,
    lastProductionAtMs,
    production: { resource: production.resource, amountPerPulse: production.amountPerPulse },
  };
}

export function parseModules(value: unknown): readonly ModuleRef[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isValidModuleRef)) return null;
  if (new Set(value.map((ref) => ref.id)).size !== value.length) return null;
  return value.map((ref) => ({ id: ref.id, version: ref.version }));
}
