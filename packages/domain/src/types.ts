import type { SignalRotation } from "@mergeforge/signalwerk";
import type { GAME_STATE_SCHEMA_VERSION } from "./constants";
import type { ModuleRef } from "./modules";
import type { FarSignal } from "./signals";

export type Terrain = "meadow" | "forest" | "hills" | "water";

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export interface HexTile {
  readonly coord: HexCoord;
  readonly terrain: Terrain;
  readonly elevation: number;
}

export interface Village {
  readonly id: string;
  readonly name: string;
  readonly coord: HexCoord;
}

export type ResourceSiteType = "stone";

export interface ResourceSite {
  readonly id: string;
  readonly type: ResourceSiteType;
  readonly tileKey: string;
}

export interface RelaySite {
  readonly id: string;
  readonly tileKey: string;
}

export type SurfaceFindResourceType = "stone";

export interface SurfaceFind {
  readonly id: string;
  readonly resourceType: SurfaceFindResourceType;
  readonly tileKey: string;
  readonly amount: number;
}

export interface WorldSnapshot {
  readonly seed: string;
  readonly generatorVersion: string;
  readonly radius: number;
  readonly tiles: readonly HexTile[];
  readonly village: Village;
  readonly visibleTileKeys: readonly string[];
  readonly resourceSites: readonly ResourceSite[];
  readonly relaySite: RelaySite;
  readonly surfaceFinds: readonly SurfaceFind[];
}

export interface ResourceStock {
  readonly wood: number;
  readonly stone: number;
}

export type BuildingStatus = "constructing" | "active";

export interface LumberCamp {
  readonly id: string;
  readonly type: "lumber-camp";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastProductionAtMs: number;
}

export interface Quarry {
  readonly id: string;
  readonly type: "quarry";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastProductionAtMs: number;
}

export interface SurveyTent {
  readonly id: string;
  readonly type: "survey-tent";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
}

export interface Workshop {
  readonly id: string;
  readonly type: "workshop";
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
}

/**
 * A building defined by a module manifest. Cost and build time are settled at
 * build start; the production rule is frozen into the building so settling
 * time never needs the manifest, and persistence checks it against the module.
 */
export interface ModuleBuilding {
  readonly id: string;
  readonly type: "module";
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly tileKey: string;
  readonly status: BuildingStatus;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastProductionAtMs: number;
  readonly production: {
    readonly resource: "wood" | "stone";
    readonly amountPerPulse: number;
  };
}

export type Building = LumberCamp | Quarry | SurveyTent | Workshop | ModuleBuilding;

export type PathfinderStatus = "training" | "active";

export interface Pathfinder {
  readonly id: string;
  readonly type: "pathfinder";
  readonly status: PathfinderStatus;
  readonly tileKey: string;
  readonly charges: number;
  readonly startedAtMs: number;
  readonly completesAtMs: number;
  readonly lastChargeAtMs: number;
}

export type Unit = Pathfinder;

export type PrologueChapterId = 3 | 4 | 5 | 6 | 7;
export type PrologueEventId =
  | "relay_discovered"
  | "signalwerk_solved"
  | "relay_repaired"
  | "first_signals_received";

/** Internal capabilities a module can later require; never a currency. */
export type RelayCapability = "signal_network_active";

export interface PrologueProgress {
  readonly stoneProductionObserved: boolean;
  readonly pathfinderSurveysCompleted: number;
  readonly completedChapterIds: readonly PrologueChapterId[];
  readonly eventIds: readonly PrologueEventId[];
}

export interface SignalwerkState {
  readonly seed: string;
  readonly rotations: readonly SignalRotation[];
  readonly solved: boolean;
}

export interface Inventory {
  readonly resonanceCore: 0 | 1;
}

export type RelayState =
  | { readonly status: "dormant"; readonly coreInstalled: false }
  | {
      readonly status: "repairing" | "active";
      readonly coreInstalled: true;
      readonly startedAtMs: number;
      readonly completesAtMs: number;
      readonly capabilities: readonly RelayCapability[];
    };

/** Mutable game progress represented as an immutable, serializable value. */
export interface GameState {
  readonly schemaVersion: typeof GAME_STATE_SCHEMA_VERSION;
  readonly world: WorldSnapshot;
  readonly resources: ResourceStock;
  readonly roadTileKeys: readonly string[];
  readonly visibleTileKeys: readonly string[];
  readonly claimedSurfaceFindTileKeys: readonly string[];
  readonly buildings: readonly Building[];
  readonly units: readonly Unit[];
  readonly prologue: PrologueProgress;
  readonly signalwerk: SignalwerkState;
  readonly inventory: Inventory;
  readonly relay: RelayState;
  /** Coarse far signals; empty until chapter 7 has been completed. */
  readonly signals: readonly FarSignal[];
  /** Modules this save depends on; empty until a module building is built. */
  readonly modules: readonly ModuleRef[];
  readonly lastAdvancedAtMs: number;
}

export type BuildRoadRejection =
  | "tile-not-found"
  | "not-visible"
  | "not-traversable"
  | "village-tile"
  | "already-road"
  | "not-connected"
  | "insufficient-wood";

export type BuildRoadResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: BuildRoadRejection;
      readonly state: GameState;
    };

export type StartLumberCampRejection =
  | "tile-not-found"
  | "not-forest"
  | "road-required"
  | "already-built"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartLumberCampResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartLumberCampRejection;
      readonly state: GameState;
    };

export type StartQuarryRejection =
  | "tile-not-found"
  | "not-stone-site"
  | "road-required"
  | "already-built"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartQuarryResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartQuarryRejection;
      readonly state: GameState;
    };

export type StartPathfinderTrainingRejection =
  | "already-exists"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartPathfinderTrainingResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartPathfinderTrainingRejection;
      readonly state: GameState;
    };

export type MovePathfinderRejection =
  | "pathfinder-not-found"
  | "pathfinder-not-active"
  | "tile-not-found"
  | "not-road-network";

export type MovePathfinderResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: MovePathfinderRejection;
      readonly state: GameState;
    };

export type SurveyWithPathfinderRejection =
  | "pathfinder-not-found"
  | "pathfinder-not-active"
  | "roadhead-required"
  | "tile-not-found"
  | "not-in-survey-range"
  | "already-visible"
  | "no-charges";

export type SurveyWithPathfinderResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: SurveyWithPathfinderRejection;
      readonly state: GameState;
    };

export type StartSurveyTentRejection =
  | "already-built"
  | "pathfinder-required"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartSurveyTentResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: StartSurveyTentRejection;
      readonly state: GameState;
    };

export type RotateSignalwerkRuneRejection =
  | "locked"
  | "already-solved"
  | "tile-not-found";

export type RotateSignalwerkRuneResult =
  | { readonly ok: true; readonly state: GameState }
  | {
      readonly ok: false;
      readonly reason: RotateSignalwerkRuneRejection;
      readonly state: GameState;
    };

export type StartWorkshopRejection =
  | "locked"
  | "already-built"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartWorkshopResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: StartWorkshopRejection; readonly state: GameState };

export type StartModuleBuildingRejection =
  | "tile-not-found"
  | "terrain-not-allowed"
  | "not-visible"
  | "road-required"
  | "already-built"
  | "module-version-conflict"
  | "build-slot-occupied"
  | "insufficient-resources";

export type StartModuleBuildingResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: StartModuleBuildingRejection; readonly state: GameState };

export type StartRelayRepairRejection =
  | "locked"
  | "workshop-required"
  | "already-started"
  | "build-slot-occupied"
  | "core-required"
  | "insufficient-resources";

export type StartRelayRepairResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: StartRelayRepairRejection; readonly state: GameState };

export type ScanFarSignalsRejection = "locked" | "already-scanned";

export type ScanFarSignalsResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: ScanFarSignalsRejection; readonly state: GameState };
