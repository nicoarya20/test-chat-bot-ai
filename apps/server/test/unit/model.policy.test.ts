import { describe, expect, it } from "bun:test";
import { resolveChatModel, usableModels } from "../../src/models/model.policy";

const DEFAULT = "d/default:free"; // test-only
const free = (...ids: string[]) => ids.map((id) => ({ id, name: id, contextLength: 1, inputModalities: ["text"] }));

describe("usableModels", () => {
  it("is the default plus the allowlist, limited to free models", () => {
    const result = usableModels(free(DEFAULT, "a/a:free", "b/b:free"), ["a/a:free", "gone/x:free"], DEFAULT);
    expect(result.map((m) => m.id)).toEqual([DEFAULT, "a/a:free"]);
  });
});

describe("resolveChatModel", () => {
  const base = { defaultModel: DEFAULT, allowed: ["a/a:free"], freeIds: new Set([DEFAULT, "a/a:free"]) };

  it("uses the conversation's model while it is allowed and free", () => {
    expect(resolveChatModel({ ...base, requested: "a/a:free" })).toEqual({ ok: true, model: "a/a:free", fellBack: false });
  });

  it("uses the default when nothing was chosen", () => {
    expect(resolveChatModel({ ...base, requested: null })).toEqual({ ok: true, model: DEFAULT, fellBack: false });
  });

  it("falls back to the default when the choice was un-allowed or stopped being free", () => {
    expect(resolveChatModel({ ...base, allowed: [], requested: "a/a:free" })).toMatchObject({ model: DEFAULT, fellBack: true });
    expect(resolveChatModel({ ...base, freeIds: new Set([DEFAULT]), requested: "a/a:free" })).toMatchObject({ model: DEFAULT, fellBack: true });
  });

  it("refuses when the default itself is no longer free", () => {
    expect(resolveChatModel({ ...base, freeIds: new Set(["a/a:free"]), requested: null })).toEqual({ ok: false, reason: "default_not_free" });
  });
});
