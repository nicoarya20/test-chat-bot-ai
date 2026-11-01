import { describe, expect, it } from "bun:test";
import { CatalogUnavailableError, createModelCatalog, toFreeModel } from "../../src/models/model.catalog";

const BASE_URL = "https://openrouter.test/api/v1"; // test-only
const raw = (id: string, prompt: string, completion: string, output = ["text"]) => ({
  id, name: `${id} name`, context_length: 1000,
  pricing: { prompt, completion }, architecture: { input_modalities: ["text", "image"], output_modalities: output },
});

describe("toFreeModel", () => {
  it("keeps text models whose every price is zero", () => {
    expect(toFreeModel(raw("a/b:free", "0", "0"))).toEqual({
      id: "a/b:free", name: "a/b:free name", contextLength: 1000, inputModalities: ["text", "image"],
    });
  });

  it("drops paid, dynamically priced (-1) and non-text-output models", () => {
    expect(toFreeModel(raw("a/paid", "0.000001", "0.000002"))).toBeNull();
    expect(toFreeModel(raw("a/half", "0", "0.000002"))).toBeNull();
    expect(toFreeModel(raw("openrouter/auto", "-1", "-1"))).toBeNull();
    expect(toFreeModel(raw("google/lyria", "0", "0", ["audio"]))).toBeNull();
    expect(toFreeModel({ id: "x/y", pricing: { prompt: "0", completion: "0", request: "0.01" } })).toBeNull();
    expect(toFreeModel({ id: "x/y" })).toBeNull();
  });
});

describe("createModelCatalog", () => {
  function setup(responses: Array<Response | Error>) {
    let clock = 0;
    let calls = 0;
    const fetchFn = (async () => {
      const next = responses[Math.min(calls, responses.length - 1)]!;
      calls += 1;
      if (next instanceof Error) throw next;
      return next.clone();
    }) as unknown as typeof fetch;
    const catalog = createModelCatalog({ baseUrl: BASE_URL, ttlMs: 1000, fetchFn, now: () => clock });
    return { catalog, advance: (ms: number) => { clock += ms; }, calls: () => calls };
  }
  const ok = (...ids: string[]) => Response.json({ data: [...ids.map((id) => raw(id, "0", "0")), raw("p/paid", "1", "1")] });

  it("returns only free models, sorted by name, and caches within the TTL", async () => {
    const { catalog, advance, calls } = setup([ok("z/z:free", "a/a:free")]);
    expect((await catalog.listFreeModels()).map((m) => m.id)).toEqual(["a/a:free", "z/z:free"]);
    advance(999);
    await catalog.listFreeModels();
    expect(calls()).toBe(1);
    advance(2);
    await catalog.listFreeModels();
    expect(calls()).toBe(2);
  });

  it("shares one request between concurrent callers", async () => {
    const { catalog, calls } = setup([ok("a/a:free")]);
    await Promise.all([catalog.listFreeModels(), catalog.listFreeModels(), catalog.listFreeModels()]);
    expect(calls()).toBe(1);
  });

  it("serves the stale list when a refresh fails", async () => {
    const { catalog, advance } = setup([ok("a/a:free"), new Response("down", { status: 503 })]);
    await catalog.listFreeModels();
    advance(5000);
    expect((await catalog.listFreeModels()).map((m) => m.id)).toEqual(["a/a:free"]);
  });

  it("throws CatalogUnavailableError with context when nothing is cached", async () => {
    const { catalog } = setup([new Error("ECONNREFUSED")]);
    const error = await catalog.listFreeModels().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CatalogUnavailableError);
    expect((error as Error).message).toContain("ECONNREFUSED");
  });
});
