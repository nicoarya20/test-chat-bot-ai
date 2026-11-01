import { describe, expect, it } from "bun:test";
import { effectiveChoice, modelDetails, modelName } from "../src/lib/model.format";
import { formatTokens } from "../src/lib/quota.format";

const model = (id: string, extra: Partial<{ name: string; contextLength: number; inputModalities: string[] }> = {}) =>
  ({ id, name: `${id} (free)`, contextLength: 262144, inputModalities: ["text"], ...extra });

describe("modelName", () => {
  it("drops the (free) suffix and falls back to the id", () => {
    expect(modelName({ id: "a/b:free", name: "Google: Gemma 4 (free)" })).toBe("Google: Gemma 4");
    expect(modelName({ id: "a/b:free", name: " (free)" })).toBe("a/b:free");
  });
});

describe("modelDetails", () => {
  it("shows context size and image support", () => {
    expect(modelDetails(model("a"), "gambar")).toBe(`${formatTokens(262144)} konteks`);
    expect(modelDetails(model("a", { contextLength: 1_000_000, inputModalities: ["text", "image"] }), "gambar")).toBe(`${formatTokens(1_000_000)} konteks · gambar`);
  });
});

describe("effectiveChoice", () => {
  const usable = [model("d/default:free"), model("a/a:free")];
  it("keeps a usable choice", () => {
    expect(effectiveChoice("a/a:free", usable, "d/default:free")).toBe("a/a:free");
  });
  it("maps the default, a missing choice or a removed model to null", () => {
    expect(effectiveChoice("d/default:free", usable, "d/default:free")).toBeNull();
    expect(effectiveChoice(null, usable, "d/default:free")).toBeNull();
    expect(effectiveChoice("gone/x:free", usable, "d/default:free")).toBeNull();
  });
});
