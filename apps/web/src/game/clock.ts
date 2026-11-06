import {
  PATHFINDER_BASE_MAX_CHARGES,
  PATHFINDER_EXPANDED_MAX_CHARGES,
  WORLD_PULSE_MS,
  type Building,
  type GameState,
  type Pathfinder,
} from '@mergeforge/domain';

/** Charge storage of the pathfinder: doubled once the survey tent is active. */
export function maxPathfinderCharges(surveyTent: Building | undefined): number {
  return surveyTent?.status === 'active'
    ? PATHFINDER_EXPANDED_MAX_CHARGES
    : PATHFINDER_BASE_MAX_CHARGES;
}

/** Earliest moment at which advancing time changes the state (build done, pulse, charge, repair). */
export function nextSettlementAt(state: GameState): number {
  const surveyTent = state.buildings.find((building) => building.type === 'survey-tent');
  const maxCharges = maxPathfinderCharges(surveyTent);
  const buildingEvents = state.buildings.map((building) => {
    if (building.status === 'constructing') return building.completesAtMs;
    return building.type === 'survey-tent' || building.type === 'workshop'
      ? Number.POSITIVE_INFINITY
      : building.lastProductionAtMs + WORLD_PULSE_MS;
  });
  const unitEvents = state.units.map((unit) =>
    unit.status === 'training'
      ? unit.completesAtMs
      : unit.charges < maxCharges
        ? unit.lastChargeAtMs + WORLD_PULSE_MS
        : Number.POSITIVE_INFINITY,
  );
  const relayEvent = state.relay.status === 'repairing'
    ? state.relay.completesAtMs
    : Number.POSITIVE_INFINITY;
  return Math.min(...buildingEvents, ...unitEvents, relayEvent, Number.POSITIVE_INFINITY);
}

/** Share of a running job that is done, clamped to 0…1. */
export function clampedProgress(elapsedMs: number, totalMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / totalMs));
}

/** Time until the pathfinder finishes training, or until its next charge. */
export function pathfinderRemainingMs(pathfinder: Pathfinder, nowMs: number): number {
  return pathfinder.status === 'training'
    ? pathfinder.completesAtMs - nowMs
    : pathfinder.lastChargeAtMs + WORLD_PULSE_MS - nowMs;
}
