import { log } from "../logging/logger";

/** A free OpenRouter model as shown to admins and users. */
export interface FreeModel {
  id: string;
  name: string;
  contextLength: number;
  inputModalities: string[];
}

/** OpenRouter's model list could not be loaded and no cached copy exists. */
export class CatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogUnavailableError";
  }
}

export interface ModelCatalog {
  /** Free text-output models, cached; throws only if OpenRouter is unreachable and nothing is cached. */
  listFreeModels(): Promise<FreeModel[]>;
}

interface RawModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: Record<string, unknown>;
  architecture?: { input_modalities?: unknown; output_modalities?: unknown };
}

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/**
 * Free = every listed price is exactly 0 (negative prices mark dynamic routers),
 * and the model writes text (excludes e.g. music-generation models).
 */
export function toFreeModel(raw: RawModel): FreeModel | null {
  if (typeof raw.id !== "string" || !raw.pricing) return null;
  const prices = Object.values(raw.pricing);
  if (prices.length === 0 || !prices.every((p) => Number(p) === 0)) return null;
  const output = asStrings(raw.architecture?.output_modalities);
  if (output.length > 0 && !(output.length === 1 && output[0] === "text")) return null;
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : raw.id,
    contextLength: typeof raw.context_length === "number" ? raw.context_length : 0,
    inputModalities: asStrings(raw.architecture?.input_modalities),
  };
}

export interface CatalogOptions {
  baseUrl: string;
  ttlMs: number;
  fetchFn?: typeof fetch;
  now?: () => number;
}

/** OpenRouter `GET /models` filtered to free models, cached for `ttlMs` (stale copy served on failure). */
export function createModelCatalog({ baseUrl, ttlMs, fetchFn = fetch, now = Date.now }: CatalogOptions): ModelCatalog {
  let cache: { models: FreeModel[]; fetchedAt: number } | null = null;
  let pending: Promise<FreeModel[]> | null = null;

  async function load(): Promise<FreeModel[]> {
    const response = await fetchFn(`${baseUrl}/models`);
    if (!response.ok) throw new Error(`OpenRouter /models returned ${response.status}`);
    const body = (await response.json()) as { data?: RawModel[] };
    if (!Array.isArray(body.data)) throw new Error("OpenRouter /models response has no data array");
    const models = body.data.map(toFreeModel).filter((m): m is FreeModel => m !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    cache = { models, fetchedAt: now() };
    return models;
  }

  async function listFreeModels(): Promise<FreeModel[]> {
    if (cache && now() - cache.fetchedAt < ttlMs) return cache.models;
    // Concurrent callers share one in-flight request.
    pending ??= load().finally(() => { pending = null; });
    try {
      return await pending;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (cache) {
        log.warn("model catalog refresh failed; serving stale list", { reason });
        return cache.models;
      }
      throw new CatalogUnavailableError(`Failed to load free model list: ${reason}`);
    }
  }

  return { listFreeModels };
}
