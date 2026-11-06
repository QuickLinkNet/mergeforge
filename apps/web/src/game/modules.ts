import { LOADED_MODULES } from '../moduleRegistry';

/** Manifests of the modules this build ships, for the catalog and the build menu. */
export const MODULE_MANIFESTS = LOADED_MODULES.map((entry) => entry.manifest);
