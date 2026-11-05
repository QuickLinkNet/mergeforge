import {
  buildRoad,
  terrainName,
  hasCompletedChapter,
  scanFarSignals,
  startPathfinderTraining,
  startRelayRepair,
  startSurveyTent,
  startWorkshop,
  type CatalogEntry,
  type GameState,
  type HexCoord,
  type ModuleManifest,
} from '@mergeforge/domain';

import { pathfinderGuidance } from './pathfinderGuidance';

export type MenuStatus =
  /** done for good (one-time entries) */
  | { readonly kind: 'done'; readonly note: string }
  /** under construction / in training / being repaired right now */
  | { readonly kind: 'running'; readonly note: string; readonly remainingMs: number }
  /** can be started now from the menu */
  | { readonly kind: 'ready'; readonly note: string }
  /** needs a field on the map; `candidates` are the fields that fit */
  | { readonly kind: 'field'; readonly note: string; readonly candidates: readonly string[] }
  /** not possible right now, with the reason in plain words */
  | { readonly kind: 'locked'; readonly note: string }
  /** a feature without a build action (explanation only) */
  | { readonly kind: 'info'; readonly note: string };

const reasonCopy: Readonly<Record<string, string>> = {
  'insufficient-resources': 'Zu wenig Rohstoffe',
  'build-slot-occupied': 'Der Bauplatz ist belegt: erst die laufende Arbeit abwarten',
  'workshop-required': 'Die Relaiswerkstatt muss fertig sein',
  'core-required': 'Der Resonanzkern fehlt',
  'pathfinder-required': 'Zuerst einen Wegfinder ausbilden',
};

export function keyToCoord(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

function slotOccupied(state: GameState): boolean {
  return (
    state.buildings.some((building) => building.status === 'constructing') ||
    state.units.some((unit) => unit.status === 'training') ||
    state.relay.status === 'repairing'
  );
}

function tileTaken(state: GameState, key: string): boolean {
  return state.buildings.some((building) => building.tileKey === key);
}

/** The map fields that fit a field-based catalog entry (the expensive part: compute once per state). */
export function fieldCandidates(
  state: GameState,
  entry: CatalogEntry,
  modules: readonly ModuleManifest[],
): readonly string[] {
  const roads = new Set(state.roadTileKeys);
  const visible = new Set(state.visibleTileKeys);
  const stoneSites = new Set(
    state.world.resourceSites.filter((site) => site.type === 'stone').map((site) => site.tileKey),
  );
  switch (entry.id) {
    case 'road':
      return state.visibleTileKeys.filter((key) => buildRoad(state, keyToCoord(key)).ok);
    case 'lumber-camp':
      return state.world.tiles
        .filter((tile) => {
          const key = `${tile.coord.q},${tile.coord.r}`;
          return tile.terrain === 'forest' && roads.has(key) && !stoneSites.has(key) && !tileTaken(state, key);
        })
        .map((tile) => `${tile.coord.q},${tile.coord.r}`);
    case 'quarry':
      return [...stoneSites].filter((key) => roads.has(key) && !tileTaken(state, key));
    default: {
      const manifest = modules.find((candidate) => `module:${candidate.id}` === entry.id);
      if (manifest === undefined) return [];
      const { placement } = manifest.building;
      return state.world.tiles
        .filter((tile) => {
          const key = `${tile.coord.q},${tile.coord.r}`;
          return (
            placement.terrain.includes(tile.terrain as never) &&
            visible.has(key) &&
            (!placement.requiresRoadConnection || roads.has(key)) &&
            !tileTaken(state, key)
          );
        })
        .map((tile) => `${tile.coord.q},${tile.coord.r}`);
    }
  }
}

function missingNote(entry: CatalogEntry, state: GameState): string | null {
  const lackWood = Math.max(0, entry.cost.wood - state.resources.wood);
  const lackStone = Math.max(0, entry.cost.stone - state.resources.stone);
  if (lackWood === 0 && lackStone === 0) return null;
  const parts = [lackWood > 0 ? `${lackWood} Holz` : '', lackStone > 0 ? `${lackStone} Stein` : ''].filter(Boolean);
  return `Es fehlen ${parts.join(' und ')}`;
}

function rejected(entry: CatalogEntry, reason: string): MenuStatus {
  return { kind: 'locked', note: reasonCopy[reason] ?? entry.condition };
}

/** Tells the player what is missing when no map field fits yet (not just what the building needs). */
function noFieldNote(entry: CatalogEntry, state: GameState, modules: readonly ModuleManifest[]): string {
  if (entry.id === 'road') {
    return state.resources.wood < 1 ? 'Es fehlt 1 Holz' : 'Kein sichtbares Feld neben dem Straßennetz';
  }
  const roads = new Set(state.roadTileKeys);
  const visible = new Set(state.visibleTileKeys);
  const taken = (key: string) => state.buildings.some((building) => building.tileKey === key);
  let label: string;
  let sightedKeys: string[];
  if (entry.id === 'quarry') {
    label = 'Steinvorkommen';
    sightedKeys = state.world.resourceSites
      .filter((site) => site.type === 'stone' && visible.has(site.tileKey))
      .map((site) => site.tileKey);
  } else {
    const manifest = modules.find((candidate) => `module:${candidate.id}` === entry.id);
    const terrains = entry.id === 'lumber-camp' ? ['forest'] : (manifest?.building.placement.terrain as readonly string[] | undefined) ?? [];
    label = terrains.map(terrainName).join(' oder ') || 'Feld';
    sightedKeys = state.world.tiles
      .filter((tile) => terrains.includes(tile.terrain) && visible.has(`${tile.coord.q},${tile.coord.r}`))
      .map((tile) => `${tile.coord.q},${tile.coord.r}`);
  }
  if (sightedKeys.length === 0) return `Noch kein ${label} in Sicht: erkunde weiter`;
  if (sightedKeys.some((key) => roads.has(key) && taken(key))) {
    return `Dein ${label}-Feld mit Straße ist schon bebaut. Baue eine Straße zu einem weiteren ${label}-Feld.`;
  }
  return `Zuerst eine Straße bis zu einem ${label}-Feld bauen`;
}

/** How one catalog entry stands for this player right now. */
export function entryStatus(
  entry: CatalogEntry,
  state: GameState,
  nowMs: number,
  candidates: readonly string[],
  modules: readonly ModuleManifest[] = [],
): MenuStatus {
  const remaining = (completesAtMs: number) => Math.max(0, completesAtMs - nowMs);
  const built = (type: string) => state.buildings.filter((building) => building.type === type);

  switch (entry.id) {
    case 'pathfinder': {
      const unit = state.units.find((candidate) => candidate.type === 'pathfinder');
      if (unit?.status === 'training') return { kind: 'running', note: 'In Ausbildung', remainingMs: remaining(unit.completesAtMs) };
      if (unit !== undefined) return { kind: 'done', note: pathfinderGuidance(state)?.text ?? 'Ausgebildet' };
      const result = startPathfinderTraining(state, nowMs);
      return result.ok ? { kind: 'ready', note: 'Im Dorf ausbilden' } : rejected(entry, result.reason);
    }
    case 'survey-tent': {
      const tent = built('survey-tent')[0];
      if (tent?.status === 'constructing') return { kind: 'running', note: 'Wird gebaut', remainingMs: remaining(tent.completesAtMs) };
      if (tent !== undefined) return { kind: 'done', note: 'Gebaut' };
      const result = startSurveyTent(state, nowMs);
      return result.ok ? { kind: 'ready', note: 'Im Dorf bauen' } : rejected(entry, result.reason);
    }
    case 'workshop': {
      const workshop = built('workshop')[0];
      if (workshop?.status === 'constructing') return { kind: 'running', note: 'Wird gebaut', remainingMs: remaining(workshop.completesAtMs) };
      if (workshop !== undefined) return { kind: 'done', note: 'Gebaut' };
      const result = startWorkshop(state, nowMs);
      return result.ok ? { kind: 'ready', note: 'Im Dorf bauen' } : rejected(entry, result.reason);
    }
    case 'signalwerk': {
      if (state.signalwerk.solved) return { kind: 'done', note: 'Gelöst, Kern geborgen' };
      return hasCompletedChapter(state, 5)
        ? { kind: 'info', note: 'Am Relais auf der Karte öffnen' }
        : { kind: 'locked', note: entry.condition };
    }
    case 'relay-repair': {
      if (state.relay.status === 'repairing') return { kind: 'running', note: 'Reparatur läuft', remainingMs: remaining(state.relay.completesAtMs) };
      if (state.relay.status === 'active') return { kind: 'done', note: 'Relais aktiv' };
      const result = startRelayRepair(state, nowMs);
      return result.ok ? { kind: 'ready', note: 'Im Dorf starten' } : rejected(entry, result.reason);
    }
    case 'signal-scan': {
      const result = scanFarSignals(state, nowMs);
      if (result.ok) return { kind: 'ready', note: 'Einmalig und kostenlos' };
      return result.reason === 'already-scanned' ? { kind: 'done', note: 'Signalnetz aktiv' } : { kind: 'locked', note: entry.condition };
    }
    case 'market':
      return state.relay.status === 'active' && hasCompletedChapter(state, 7)
        ? { kind: 'info', note: 'Karte „Handelsposten“ im Seitenfenster' }
        : { kind: 'locked', note: entry.condition };
    default: {
      // Field-based: road, lumber camp, quarry and modules.
      const running = state.buildings.find(
        (building) =>
          building.status === 'constructing' &&
          (entry.id.startsWith('module:') ? building.type === 'module' && `module:${building.moduleId}` === entry.id : building.type === entry.id),
      );
      const count = state.buildings.filter((building) =>
        entry.id.startsWith('module:') ? building.type === 'module' && `module:${building.moduleId}` === entry.id : building.type === entry.id,
      ).length;
      if (running !== undefined) return { kind: 'running', note: 'Wird gebaut', remainingMs: remaining(running.completesAtMs) };
      if (entry.usesBuildSlot && slotOccupied(state)) return { kind: 'locked', note: reasonCopy['build-slot-occupied'] ?? '' };
      if (candidates.length === 0) return { kind: 'locked', note: noFieldNote(entry, state, modules) };
      const lack = missingNote(entry, state);
      if (lack !== null) return { kind: 'locked', note: lack };
      const owned = count > 0 ? ` · ${count} gebaut` : '';
      return {
        kind: 'field',
        note: `${candidates.length} passende${candidates.length === 1 ? 's Feld' : ' Felder'}${owned}`,
        candidates,
      };
    }
  }
}
