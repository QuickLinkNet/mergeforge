import { advanceTime, createInitialGameState, type GameState } from '@mergeforge/domain';
import { generateWorld } from '@mergeforge/worldgen';
import { LOADED_MODULES, MODULE_REGISTRY } from '../moduleRegistry';
import { loadGame, type StorageLike } from '../persistence';

export const WORLD_RADIUS = 12;
const CLOCK_SKEW_NOTICE_MS = 5 * 60 * 1_000;

export type BootstrapResult =
  | { readonly ok: true; readonly state: GameState; readonly notice: string | null }
  | { readonly ok: false; readonly error: string; readonly blocked?: true };

/** Generates the world and loads (or safely resets) the saved game for it. */
export function bootstrapGame(nowMs: number, worldSeed: string, storage: StorageLike): BootstrapResult {
  try {
    const world = generateWorld({ seed: worldSeed, radius: WORLD_RADIUS });
    const freshState = createInitialGameState(world, nowMs);
    let loaded: ReturnType<typeof loadGame>;
    try {
      loaded = loadGame(
        storage,
        world,
        MODULE_REGISTRY,
        LOADED_MODULES.map((entry) => entry.manifest),
      );
    } catch {
      return {
        ok: true,
        state: freshState,
        notice: 'Der lokale Speicher ist nicht verfügbar. Diese Sitzung läuft ohne Speicherung.',
      };
    }

    if (loaded.kind === 'loaded') {
      return {
        ok: true,
        state: advanceTime(loaded.state, Math.max(nowMs, loaded.state.lastAdvancedAtMs)),
        notice: loaded.state.lastAdvancedAtMs - nowMs > CLOCK_SKEW_NOTICE_MS
          ? 'Die Uhr deines Geräts geht nach oder ging vor. Der Spielstand pausiert, bis die Uhr den gespeicherten Zeitpunkt wieder erreicht.'
          : null,
      };
    }
    if (loaded.kind === 'blocked') {
      const names = loaded.missing.map((ref) => `${ref.id} (${ref.version})`).join(', ');
      return {
        ok: false,
        blocked: true,
        error: `Dieser Spielstand braucht ein fehlendes Modul: ${names}. Der Spielstand bleibt unverändert gespeichert. Stellt das Modul wieder her und prüft erneut.`,
      };
    }
    if (loaded.kind === 'reset') {
      return {
        ok: true,
        state: freshState,
        notice:
          loaded.reason === 'incompatible'
            ? 'Der ältere Spielstand passt nicht zu dieser Weltversion und wurde sicher neu begonnen.'
            : 'Der lokale Spielstand war beschädigt und wurde sicher zurückgesetzt.',
      };
    }
    return { ok: true, state: freshState, notice: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Die Welt konnte nicht erzeugt werden.',
    };
  }
}
