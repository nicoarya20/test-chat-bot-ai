import type { Database } from "../db/client";
import { getSettings } from "../settings/settings.repository";
import { listAllowedModels } from "./allowed-models.repository";
import type { FreeModel, ModelCatalog } from "./model.catalog";
import { usableModels } from "./model.policy";

export interface ModelChoices {
  free: FreeModel[];
  freeIds: Set<string>;
  allowed: string[];
  defaultModel: string;
  /** What users can pick right now: default + allowlist, free only. */
  usable: FreeModel[];
}

/** Gathers the live free list, the allowlist and the admin default in one place. */
export async function getModelChoices(db: Database, catalog: ModelCatalog): Promise<ModelChoices> {
  const [free, allowed, settings] = await Promise.all([catalog.listFreeModels(), listAllowedModels(db), getSettings(db)]);
  return {
    free, freeIds: new Set(free.map((m) => m.id)), allowed, defaultModel: settings.model,
    usable: usableModels(free, allowed, settings.model),
  };
}
