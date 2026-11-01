import type { FreeModel } from "./model.catalog";

/** Models a user may pick: the admin default plus the allowlist, limited to currently free ones. */
export function usableModels(free: FreeModel[], allowed: string[], defaultModel: string): FreeModel[] {
  const wanted = new Set([defaultModel, ...allowed]);
  return free.filter((m) => wanted.has(m.id));
}

export type ModelResolution =
  | { ok: true; model: string; fellBack: boolean }
  | { ok: false; reason: "default_not_free" };

/**
 * Picks the model for a chat turn. The conversation's choice wins while it is
 * still allowed and free; otherwise the admin default, which must itself be free.
 */
export function resolveChatModel(input: {
  requested: string | null; defaultModel: string; allowed: string[]; freeIds: Set<string>;
}): ModelResolution {
  const { requested, defaultModel, allowed, freeIds } = input;
  if (requested && requested !== defaultModel && allowed.includes(requested) && freeIds.has(requested)) {
    return { ok: true, model: requested, fellBack: false };
  }
  if (!freeIds.has(defaultModel)) return { ok: false, reason: "default_not_free" };
  return { ok: true, model: defaultModel, fellBack: requested !== null && requested !== defaultModel };
}
