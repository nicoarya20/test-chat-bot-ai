import { CatalogUnavailableError, type FreeModel, type ModelCatalog } from "../../src/models/model.catalog";

// test-only: slugs the fake OpenRouter catalog reports as free.
export const FREE_TEST_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-coder:free",
];

/** In-memory catalog; tests edit `ids` or set `unavailable` to simulate OpenRouter changes. */
export class FakeCatalog implements ModelCatalog {
  ids = [...FREE_TEST_MODELS];
  unavailable = false;

  async listFreeModels(): Promise<FreeModel[]> {
    if (this.unavailable) throw new CatalogUnavailableError("fake catalog offline");
    return this.ids.map((id) => ({ id, name: id, contextLength: 128000, inputModalities: ["text"] }));
  }
}
