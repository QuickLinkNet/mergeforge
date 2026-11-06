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
): readonly Building[] | null {
  if (!Array.isArray(value)) return null;
  const buildings: Building[] = [];
  const ids = new Set<string>();
  const tileKeys = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const isVillageBuilding = candidate.type === 'survey-tent' || candidate.type === 'workshop';
    const startedAtMs = parseTimestamp(candidate.startedAtMs);
    const completesAtMs = parseTimestamp(candidate.completesAtMs);
    if (
      typeof candidate.id !== 'string' ||
      (candidate.type !== 'lumber-camp' && candidate.type !== 'quarry' && candidate.type !== 'survey-tent' && candidate.type !== 'workshop' && candidate.type !== 'module') ||
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
      ((candidate.type === 'survey-tent' || candidate.type === 'workshop') && candidate.tileKey !== villageTileKey)
    ) {
      return null;
    }

    ids.add(candidate.id);
    if (!isVillageBuilding) tileKeys.add(candidate.tileKey);
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
