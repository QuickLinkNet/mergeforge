import type { ModuleRef } from '@mergeforge/domain';

/**
 * Modules this build provides. Empty until the loader (modules/<id>/) lands;
 * saves that reference a module missing here are blocked, not reset.
 */
export const MODULE_REGISTRY: readonly ModuleRef[] = [];
