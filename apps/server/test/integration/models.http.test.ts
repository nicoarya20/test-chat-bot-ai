import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { usageLogs } from "../../src/db/schema";
import { encryptSecret } from "../../src/keys/key.cipher";
import { createKey } from "../../src/keys/keys.repository";
import { buildTestApp, readSse, testEncryptionKey } from "../helpers/app";
import { createUser, resetDb } from "../helpers/db";

const API_KEY = "sk-or-v1-test-models-000000000"; // test-only
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const GEMMA = "google/gemma-4-31b-it:free";
const QWEN = "qwen/qwen3-coder:free";
const PAID = "anthropic/claude-opus-5.5";

describe("model choice API", () => {
  let ctx: ReturnType<typeof buildTestApp>;
  const body = (method: string, data: unknown) => ({ method, body: JSON.stringify(data) });

  beforeEach(async () => {
    await resetDb();
    ctx = buildTestApp();
  });

  async function setup() {
    const admin = await createUser({ role: "admin" });
    await createKey(ctx.db, { label: "k", ciphertext: encryptSecret(API_KEY, testEncryptionKey), last4: "0000", createdBy: admin.id });
    const u = await createUser();
    return { admin, u };
  }
  const allow = (adminId: string, models: string[]) => ctx.request("/admin/models/allowed", adminId, body("PUT", { models }));
  const newChat = async (userId: string, model?: string | null) =>
    ctx.request("/conversations", userId, body("POST", { title: "Halo", ...(model !== undefined && { model }) }));
  const send = (userId: string, convId: string) =>
    ctx.request(`/conversations/${convId}/messages`, userId, body("POST", { text: "hai" }));

  it("shows admins every free model, the allowlist and the default", async () => {
    const { admin } = await setup();
    await allow(admin.id, [GEMMA]);
    const res = await (await ctx.request("/admin/models", admin.id)).json();
    expect(res.free.map((m: { id: string }) => m.id)).toContain(QWEN);
    expect(res).toMatchObject({ allowed: [GEMMA], defaultModel: DEFAULT_MODEL });
  });

  it("only lets admins allow free models", async () => {
    const { admin, u } = await setup();
    const rejected = await allow(admin.id, [GEMMA, PAID]);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toEqual({ error: "model_not_free", models: [PAID] });
    expect((await allow(u.id, [GEMMA])).status).toBe(403);
    expect(await (await allow(admin.id, [QWEN, GEMMA, GEMMA])).json()).toEqual({ allowed: [GEMMA, QWEN] });
  });

  it("rejects a paid default model in settings", async () => {
    const { admin } = await setup();
    const res = await ctx.request("/admin/settings", admin.id, body("PUT", { model: PAID }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("model_not_free");
  });

  it("lists the default plus allowed models that are still free for users", async () => {
    const { admin, u } = await setup();
    await allow(admin.id, [GEMMA, QWEN]);
    ctx.catalog.ids = ctx.catalog.ids.filter((id) => id !== QWEN);
    const res = await (await ctx.request("/models", u.id)).json();
    expect(res.models.map((m: { id: string }) => m.id).sort()).toEqual([GEMMA, DEFAULT_MODEL].sort());
    expect(res.defaultModel).toBe(DEFAULT_MODEL);
    const pending = await createUser({ status: "pending" });
    expect((await ctx.request("/models", pending.id)).status).toBe(403);
  });

  it("validates the model when creating or switching a conversation", async () => {
    const { admin, u } = await setup();
    await allow(admin.id, [GEMMA]);
    expect((await newChat(u.id, QWEN)).status).toBe(400);
    const conv = await (await newChat(u.id, GEMMA)).json();
    expect(conv.model).toBe(GEMMA);

    expect((await ctx.request(`/conversations/${conv.id}`, u.id, body("PATCH", { model: PAID }))).status).toBe(400);
    expect((await ctx.request(`/conversations/${conv.id}`, u.id, body("PATCH", { model: null }))).status).toBe(200);
    const page = await (await ctx.request(`/conversations/${conv.id}/messages`, u.id)).json();
    expect(page.conversation.model).toBeNull();
  });

  it("answers with the chosen model and counts every model against one quota", async () => {
    const { admin, u } = await setup();
    await allow(admin.id, [GEMMA]);
    const a = await (await newChat(u.id, GEMMA)).json();
    const b = await (await newChat(u.id)).json();
    const first = (await readSse(await send(u.id, a.id))).find((e) => e.event === "done")!;
    expect(first.data).toMatchObject({ model: GEMMA, fellBack: false });
    const second = (await readSse(await send(u.id, b.id))).find((e) => e.event === "done")!;
    expect(second.data).toMatchObject({ model: DEFAULT_MODEL, quota: { sessionUsed: 300, weeklyUsed: 300 } });
    expect(ctx.gateway.calls.map((c) => c.model)).toEqual([GEMMA, DEFAULT_MODEL]);
    const logs = await ctx.db.select().from(usageLogs).where(eq(usageLogs.userId, u.id));
    expect(logs.map((l) => l.model).sort()).toEqual([DEFAULT_MODEL, GEMMA].sort());
  });

  it("falls back to the default when the chosen model stops being free", async () => {
    const { admin, u } = await setup();
    await allow(admin.id, [GEMMA]);
    const conv = await (await newChat(u.id, GEMMA)).json();
    ctx.catalog.ids = ctx.catalog.ids.filter((id) => id !== GEMMA);
    const done = (await readSse(await send(u.id, conv.id))).find((e) => e.event === "done")!;
    expect(done.data).toMatchObject({ model: DEFAULT_MODEL, fellBack: true });
  });

  it("refuses to call the model when the default is no longer free", async () => {
    const { u } = await setup();
    const conv = await (await newChat(u.id)).json();
    ctx.catalog.ids = [GEMMA];
    const events = await readSse(await send(u.id, conv.id));
    expect(events.find((e) => e.event === "error")!.data.code).toBe("model_not_free");
    expect(ctx.gateway.calls).toHaveLength(0);
  });

  it("fails closed when the OpenRouter model list is unavailable", async () => {
    const { u } = await setup();
    const conv = await (await newChat(u.id)).json();
    ctx.catalog.unavailable = true;
    const events = await readSse(await send(u.id, conv.id));
    expect(events.find((e) => e.event === "error")!.data.code).toBe("catalog_unavailable");
    expect(ctx.gateway.calls).toHaveLength(0);
    const res = await ctx.request("/models", u.id);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "catalog_unavailable" });
  });
});
