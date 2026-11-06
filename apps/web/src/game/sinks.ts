import {
  LUMBER_CAMP_WOOD_PER_PULSE,
  LUMBER_UPGRADE_WOOD_PER_PULSE,
  PRODUCTION_UPGRADES,
  QUARRY_STONE_PER_PULSE,
  QUARRY_UPGRADE_STONE_PER_PULSE,
  STOREHOUSE_MAX_LEVEL,
  findProductionUpgrade,
  findStorehouse,
  nextStorehouseLevel,
  startProductionUpgrade,
  startStorehouse,
  storageLimits,
  storageLimitsAtLevel,
  storehouseLevel,
  storehouseLevelSpec,
  yieldPerPulse,
  type Building,
  type CatalogEntry,
  type GameState,
  type ProductionUpgradeType,
  type ResourceStock,
  type StartProductionUpgradeRejection,
  type StartProductionUpgradeResult,
  type StartStorehouseRejection,
  type StartStorehouseResult,
} from '@mergeforge/domain';
import { formatRemaining } from './copy';

/** Phase B sinks (D-023): storehouse levels and the two production upgrades. */
export type SinkId = 'storehouse' | ProductionUpgradeType;
export const SINK_IDS: readonly SinkId[] = ['storehouse', 'lumber-upgrade', 'quarry-upgrade'];

export function isSinkId(id: string): id is SinkId {
  return (SINK_IDS as readonly string[]).includes(id);
}

const SINK_NAMES: Readonly<Record<SinkId, string>> = {
  storehouse: 'Lagerhaus',
  'lumber-upgrade': 'Holzfäller-Ausbau',
  'quarry-upgrade': 'Steinbruch-Ausbau',
};

/** "450 Holz / 225 Stein" */
export function storageText(limits: ResourceStock): string {
  return `${limits.wood} Holz / ${limits.stone} Stein`;
}

export const storehouseFailureCopy: Readonly<Record<StartStorehouseRejection, string>> = {
  locked: 'Das Lagerhaus wird erst nach Kapitel 7 (Fernsignal scannen) freigeschaltet.',
  'max-level': `Das Lagerhaus hat bereits Stufe ${STOREHOUSE_MAX_LEVEL} von ${STOREHOUSE_MAX_LEVEL}.`,
  'build-slot-occupied': 'Der Bauplatz ist belegt: erst die laufende Arbeit abwarten',
  'insufficient-resources': 'Für diese Lagerhaus-Stufe fehlen Holz oder Stein.',
};

export function upgradeFailureCopy(type: ProductionUpgradeType, reason: StartProductionUpgradeRejection): string {
  const producer = type === 'lumber-upgrade' ? 'ein Holzfällerlager' : 'einen Steinbruch';
  switch (reason) {
    case 'locked': return 'Wird erst nach Kapitel 7 (Fernsignal scannen) freigeschaltet.';
    case 'producer-required': return `Zuerst ${producer} fertig bauen.`;
    case 'already-built': return `Der ${SINK_NAMES[type]} ist bereits fertig.`;
    case 'build-slot-occupied': return 'Der Bauplatz ist belegt: erst die laufende Arbeit abwarten';
    case 'insufficient-resources': return `Für den ${SINK_NAMES[type]} fehlen Holz oder Stein.`;
  }
}

/** Cost and build time the next order of this sink would have (the next storehouse level). */
export function sinkCost(id: SinkId, state: GameState): { readonly wood: number; readonly stone: number; readonly buildMs: number } {
  if (id !== 'storehouse') return PRODUCTION_UPGRADES[id];
  const level = nextStorehouseLevel(state) ?? findStorehouse(state)?.level ?? 1;
  return storehouseLevelSpec(level);
}

/** The catalog entry as the build menu shows it now: the storehouse names the cost of its next level. */
export function menuEntryForState(entry: CatalogEntry, state: GameState): CatalogEntry {
  if (entry.id !== 'storehouse') return entry;
  const cost = sinkCost('storehouse', state);
  return { ...entry, cost: { wood: cost.wood, stone: cost.stone }, buildMs: cost.buildMs };
}

/** "Es fehlen 12 Holz und 3 Stein", or null when the stock is enough. */
export function missingResources(cost: { readonly wood: number; readonly stone: number }, state: GameState): string | null {
  const lackWood = Math.max(0, cost.wood - state.resources.wood);
  const lackStone = Math.max(0, cost.stone - state.resources.stone);
  if (lackWood === 0 && lackStone === 0) return null;
  const parts = [lackWood > 0 ? `${lackWood} Holz` : '', lackStone > 0 ? `${lackStone} Stein` : ''].filter(Boolean);
  return `Es fehlen ${parts.join(' und ')}`;
}

/** Dry run of the order behind a sink card (nothing changes). */
export function previewSink(id: SinkId, state: GameState, nowMs: number): StartStorehouseResult | StartProductionUpgradeResult {
  return id === 'storehouse' ? startStorehouse(state, nowMs) : startProductionUpgrade(state, id, nowMs);
}

export function sinkFailureCopy(id: SinkId, reason: string): string {
  return id === 'storehouse'
    ? storehouseFailureCopy[reason as StartStorehouseRejection] ?? reason
    : upgradeFailureCopy(id, reason as StartProductionUpgradeRejection);
}

/** Title of the confirmation card and of the start message ("Lagerhaus Stufe 2"). */
export function sinkTitle(id: SinkId, state: GameState): string {
  if (id !== 'storehouse') return SINK_NAMES[id];
  const level = nextStorehouseLevel(state);
  return level === null ? SINK_NAMES.storehouse : `${SINK_NAMES.storehouse} Stufe ${level}`;
}

/** What the order changes, in one line for the confirmation card. */
export function sinkEffect(id: SinkId, state: GameState): string {
  if (id === 'storehouse') {
    const level = nextStorehouseLevel(state);
    const after = storageLimitsAtLevel(level ?? STOREHOUSE_MAX_LEVEL);
    return `Lager ${storageText(storageLimits(state))} → ${storageText(after)}`;
  }
  return id === 'lumber-upgrade'
    ? `Holzfällerlager: ${LUMBER_CAMP_WOOD_PER_PULSE} → ${LUMBER_UPGRADE_WOOD_PER_PULSE} Holz pro Takt`
    : `Steinbruch: ${QUARRY_STONE_PER_PULSE} → ${QUARRY_UPGRADE_STONE_PER_PULSE} Stein pro Takt`;
}

/** Toast after a successful order. */
export function sinkStartMessage(id: SinkId, before: GameState): string {
  return `${sinkTitle(id, before)} beauftragt · Fertigstellung in ${formatRemaining(sinkCost(id, before).buildMs)}`;
}

function sinkKey(building: Building): string | null {
  if (building.type === 'storehouse') return `storehouse:${building.level}`;
  if (building.type === 'lumber-upgrade' || building.type === 'quarry-upgrade') return building.type;
  return null;
}

/** Toast when a sink construction finished between two states, or null. */
export function sinkCompletionMessage(previous: GameState, next: GameState): string | null {
  const wasConstructing = new Set(
    previous.buildings.filter((building) => building.status === 'constructing').map(sinkKey).filter((key) => key !== null),
  );
  for (const building of next.buildings) {
    const key = sinkKey(building);
    if (key === null || building.status !== 'active' || !wasConstructing.has(key)) continue;
    if (building.type === 'storehouse') {
      return `Lagerhaus Stufe ${building.level} fertig · Lager fasst jetzt ${storageText(storageLimits(next))}`;
    }
    const producer = next.buildings.find((candidate) =>
      building.type === 'lumber-upgrade' ? candidate.type === 'lumber-camp' : candidate.type === 'quarry');
    const amount = producer?.type === 'lumber-camp' || producer?.type === 'quarry' ? yieldPerPulse(next, producer).amount : 0;
    return building.type === 'lumber-upgrade'
      ? `Holzfäller-Ausbau fertig · Jedes Holzfällerlager liefert jetzt ${amount} Holz pro Takt`
      : `Steinbruch-Ausbau fertig · Jeder Steinbruch liefert jetzt ${amount} Stein pro Takt`;
  }
  return null;
}

export type SinkStatus =
  | { readonly kind: 'done'; readonly note: string }
  | { readonly kind: 'running'; readonly note: string; readonly remainingMs: number }
  | { readonly kind: 'ready'; readonly note: string }
  | { readonly kind: 'locked'; readonly note: string };

/** Build menu status of a sink entry: level, running build with remaining time, or why it is locked. */
export function sinkStatus(id: SinkId, state: GameState, nowMs: number): SinkStatus {
  const remaining = (completesAtMs: number) => Math.max(0, completesAtMs - nowMs);
  if (id === 'storehouse') {
    const storehouse = findStorehouse(state);
    const current = storehouseLevel(state);
    const levelText = `Stufe ${current} von ${STOREHOUSE_MAX_LEVEL}`;
    if (storehouse?.status === 'constructing') {
      return { kind: 'running', note: `${levelText} · Stufe ${storehouse.level} wird gebaut`, remainingMs: remaining(storehouse.completesAtMs) };
    }
    if (current >= STOREHOUSE_MAX_LEVEL) {
      return { kind: 'done', note: `${levelText} · Lager ${storageText(storageLimits(state))}` };
    }
    const result = startStorehouse(state, nowMs);
    if (result.ok) {
      return { kind: 'ready', note: `${levelText} · Ausbau: Lager ${storageText(storageLimitsAtLevel(current + 1))}` };
    }
    const note = result.reason === 'insufficient-resources'
      ? missingResources(sinkCost(id, state), state) ?? storehouseFailureCopy[result.reason]
      : storehouseFailureCopy[result.reason];
    return { kind: 'locked', note: `${levelText} · ${note}` };
  }
  const upgrade = findProductionUpgrade(state, id);
  if (upgrade?.status === 'constructing') return { kind: 'running', note: 'Ausbau läuft', remainingMs: remaining(upgrade.completesAtMs) };
  if (upgrade !== undefined) {
    return {
      kind: 'done',
      note: id === 'lumber-upgrade'
        ? `Ausgebaut · ${LUMBER_UPGRADE_WOOD_PER_PULSE} Holz pro Takt`
        : `Ausgebaut · ${QUARRY_UPGRADE_STONE_PER_PULSE} Stein pro Takt`,
    };
  }
  const result = startProductionUpgrade(state, id, nowMs);
  if (result.ok) return { kind: 'ready', note: 'Im Dorf ausbauen' };
  return {
    kind: 'locked',
    note: result.reason === 'insufficient-resources'
      ? missingResources(PRODUCTION_UPGRADES[id], state) ?? upgradeFailureCopy(id, result.reason)
      : upgradeFailureCopy(id, result.reason),
  };
}
