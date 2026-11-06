import type {
  BuildRoadRejection,
  MovePathfinderRejection,
  StartLumberCampRejection,
  StartPathfinderTrainingRejection,
  StartQuarryRejection,
  StartRelayRepairRejection,
  StartSurveyTentRejection,
  StartWorkshopRejection,
  SurveyWithPathfinderRejection,
} from '@mergeforge/domain';

/** Player-facing explanations for every rejected command, keyed by the domain reason. */

export const roadFailureCopy: Readonly<Record<BuildRoadRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-visible': 'Dieses Feld liegt noch hinter dem Nebel.',
  'not-traversable': 'Auf diesem Gelände kann keine Straße entstehen.',
  'village-tile': 'Der Dorfkern ist bereits der Ausgangspunkt eures Straßennetzes.',
  'already-road': 'Auf diesem Feld liegt bereits eine Straße.',
  'not-connected': 'Die Straße muss am Dorf oder Straßennetz anschließen.',
  'insufficient-wood': 'Für diese Straße fehlt Holz.',
};

export const lumberFailureCopy: Readonly<Record<StartLumberCampRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-forest': 'Ein Holzfällerlager benötigt ein Waldfeld.',
  'road-required': 'Das Waldfeld muss zuerst per Straße verbunden werden.',
  'already-built': 'Auf diesem Waldfeld steht bereits ein Holzfällerlager.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Gebäude.',
  'insufficient-resources': 'Für das Holzfällerlager fehlen Rohstoffe.',
};

export const quarryFailureCopy: Readonly<Record<StartQuarryRejection, string>> = {
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-stone-site': 'Ein Steinbruch benötigt ein ausgewiesenes Steinvorkommen.',
  'road-required': 'Das Steinvorkommen muss zuerst per Straße verbunden werden.',
  'already-built': 'Auf diesem Vorkommen steht bereits ein Steinbruch.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Gebäude.',
  'insufficient-resources': 'Für den Steinbruch fehlen Rohstoffe.',
};

export const trainingFailureCopy: Readonly<Record<StartPathfinderTrainingRejection, string>> = {
  'already-exists': 'Euer Dorf besitzt bereits einen Wegfinder.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'insufficient-resources': 'Für die Ausbildung fehlen Holz oder Stein.',
};

export const movementFailureCopy: Readonly<Record<MovePathfinderRejection, string>> = {
  'pathfinder-not-found': 'Im Dorf ist noch kein Wegfinder ausgebildet.',
  'pathfinder-not-active': 'Der Wegfinder befindet sich noch in Ausbildung.',
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-road-network': 'Der Wegfinder bewegt sich nur auf dem verbundenen Straßennetz.',
};

export const surveyFailureCopy: Readonly<Record<SurveyWithPathfinderRejection, string>> = {
  'pathfinder-not-found': 'Im Dorf ist noch kein Wegfinder ausgebildet.',
  'pathfinder-not-active': 'Der Wegfinder befindet sich noch in Ausbildung.',
  'roadhead-required': 'Vermessungen beginnen an einem Straßenkopf.',
  'tile-not-found': 'Dieses Feld gehört nicht zur bekannten Welt.',
  'not-in-survey-range': 'Das Ziel liegt außerhalb der Vermessungsreichweite.',
  'already-visible': 'Dieses Feld ist bereits kartiert.',
  'no-charges': 'Die nächste Expeditionsladung ist noch nicht bereit.',
};

export const surveyTentFailureCopy: Readonly<Record<StartSurveyTentRejection, string>> = {
  'already-built': 'Das Vermesserzelt steht bereits am Dorf.',
  'pathfinder-required': 'Das Vermesserzelt wird erst mit einem aktiven Wegfinder freigeschaltet.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'insufficient-resources': 'Für das Vermesserzelt fehlen Holz oder Stein.',
};

export const workshopFailureCopy: Readonly<Record<StartWorkshopRejection, string>> = {
  locked: 'Die Werkstatt wird erst nach dem gelösten Signalwerk freigeschaltet.',
  'already-built': 'Die Werkstatt steht bereits im Dorf.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'insufficient-resources': 'Für die Werkstatt fehlen Holz oder Stein.',
};

export const relayRepairFailureCopy: Readonly<Record<StartRelayRepairRejection, string>> = {
  locked: 'Das Relais ist noch nicht für die Reparatur freigeschaltet.',
  'workshop-required': 'Für die Reparatur wird eine aktive Werkstatt benötigt.',
  'already-started': 'Die Relaisreparatur wurde bereits begonnen.',
  'build-slot-occupied': 'Euer Bautrupp arbeitet bereits an einem anderen Auftrag.',
  'core-required': 'Der Resonanzkern fehlt.',
  'insufficient-resources': 'Für die Relaisreparatur fehlen Holz oder Stein.',
};
