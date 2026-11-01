import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { messages, usageLogs } from "../../src/db/schema";
import { encryptSecret } from "../../src/keys/key.cipher";
import { createKey } from "../../src/keys/keys.repository";
import { updateSettings } from "../../src/settings/settings.repository";
import { buildTestApp, readSse, testEncryptionKey } from "../helpers/app";
import { createUser, resetDb } from "../helpers/db";

const API_KEY = "sk-ant-test-chat-000000000000"; // test-only

describe("chat API", () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    await resetDb();
    ctx = buildTestApp();
  });

  async function setup(userOverrides = {}) {
    const admin = await createUser({ role: "admin" });
    await createKey(ctx.db, { label: "k", ciphertext: encryptSecret(API_KEY, testEncryptionKey), last4: "0000", createdBy: admin.id });
    const u = await createUser(userOverrides);
    const res = await ctx.request("/conversations", u.id, { method: "POST", body: JSON.stringify({ title: "Halo" }) });
    const conv = await res.json();
    return { u, conv };
  }
  const send = (userId: string, convId: string, text: string) =>
    ctx.request(`/conversations/${convId}/messages`, userId, { method: "POST", body: JSON.stringify({ text }) });

  it("streams deltas, saves the exchange and records usage", async () => {
    const { u, conv } = await setup();
    const events = await readSse(await send(u.id, conv.id, "Apa kabar?"));
    expect(events.filter((e) => e.event === "delta").map((e) => e.data.text)).toEqual(["Halo", " dunia"]);
    const done = events.find((e) => e.event === "done")!;
    expect(done.data.quota).toMatchObject({ sessionUsed: 150, weeklyUsed: 150 });

    const saved = await ctx.db.select().from(messages).where(eq(messages.conversationId, conv.id));
    expect(saved.map((m) => [m.role, m.text])).toEqual([["user", "Apa kabar?"], ["assistant", "Halo dunia"]]);
    const call = ctx.gateway.calls[0]!;
    expect(call).toMatchObject({ apiKey: API_KEY, model: "claude-opus-5-5", effort: "medium", maxTokens: 50000 });
  });

  it("replays previous assistant content blocks unchanged (thinking included)", async () => {
    const { u, conv } = await setup();
    await readSse(await send(u.id, conv.id, "satu"));
    await readSse(await send(u.id, conv.id, "dua"));
    const second = ctx.gateway.calls[1]!;
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1]).toEqual({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "", signature: "sig-test" },
        { type: "text", text: "Halo dunia", citations: null },
      ],
    } as never);
  });

  it("freezes the model per conversation when settings change", async () => {
    const { u, conv } = await setup();
    await updateSettings(ctx.db, { model: "claude-sonnet-5-5" });
    await readSse(await send(u.id, conv.id, "hi"));
    expect(ctx.gateway.calls[0]!.model).toBe("claude-opus-5-5");
  });

  it("refuses with quota_exceeded and the reset time once the session cap is spent", async () => {
    const { u, conv } = await setup({ sessionTokenLimit: 100 });
    await readSse(await send(u.id, conv.id, "pertama")); // uses 150 > 100, still completes
    const events = await readSse(await send(u.id, conv.id, "kedua"));
    const error = events.find((e) => e.event === "error")!;
    expect(error.data.code).toBe("quota_exceeded");
    expect(error.data.details.blockedBy).toBe("session");
    expect(typeof error.data.details.resetAt).toBe("string");
    expect(ctx.gateway.calls).toHaveLength(1);
  });

  it("raises max_tokens to the floor when little quota remains", async () => {
    const { u, conv } = await setup({ sessionTokenLimit: 200 });
    await readSse(await send(u.id, conv.id, "a")); // 150 used, 50 left
    await readSse(await send(u.id, conv.id, "b"));
    expect(ctx.gateway.calls[1]!.maxTokens).toBe(4096);
  });

  it("reports no_api_key when no key is active", async () => {
    const u = await createUser();
    const conv = await (await ctx.request("/conversations", u.id, { method: "POST", body: JSON.stringify({ title: "x" }) })).json();
    const events = await readSse(await send(u.id, conv.id, "hi"));
    expect(events.find((e) => e.event === "error")?.data.code).toBe("no_api_key");
  });

  it("records usage but saves nothing when the model refuses", async () => {
    const { u, conv } = await setup();
    ctx.gateway.next = { stopReason: "refusal", deltas: ["partial"] };
    const events = await readSse(await send(u.id, conv.id, "bad"));
    expect(events.find((e) => e.event === "error")?.data.code).toBe("refused");
    expect(await ctx.db.select().from(messages).where(eq(messages.conversationId, conv.id))).toHaveLength(0);
    expect(await ctx.db.select().from(usageLogs).where(eq(usageLogs.userId, u.id))).toHaveLength(1);
  });

  it("maps Anthropic auth failures to upstream_auth and saves nothing", async () => {
    const { u, conv } = await setup();
    ctx.gateway.next = { error: new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers()) };
    const events = await readSse(await send(u.id, conv.id, "hi"));
    expect(events.find((e) => e.event === "error")?.data.code).toBe("upstream_auth");
    expect(await ctx.db.select().from(messages).where(eq(messages.conversationId, conv.id))).toHaveLength(0);
  });

  it("rejects a second send while a reply is in flight", async () => {
    const { u, conv } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const original = ctx.gateway.stream.bind(ctx.gateway);
    ctx.gateway.stream = async (input, onText) => { await gate; return original(input, onText); };
    const first = send(u.id, conv.id, "satu");
    await Bun.sleep(50);
    const second = await readSse(await send(u.id, conv.id, "dua"));
    expect(second.find((e) => e.event === "error")?.data.code).toBe("busy");
    release();
    expect((await readSse(await first)).some((e) => e.event === "done")).toBe(true);
  });

  it("isolates conversations between users", async () => {
    const { conv } = await setup();
    const other = await createUser();
    expect((await ctx.request(`/conversations/${conv.id}/messages`, other.id)).status).toBe(404);
    const events = await readSse(await send(other.id, conv.id, "hi"));
    expect(events.find((e) => e.event === "error")?.data.code).toBe("not_found");
    expect((await ctx.request(`/conversations/${conv.id}`, other.id, { method: "DELETE" })).status).toBe(404);
  });

  it("lists, renames and deletes own conversations", async () => {
    const { u, conv } = await setup();
    await ctx.request(`/conversations/${conv.id}`, u.id, { method: "PATCH", body: JSON.stringify({ title: "Baru" }) });
    const list = await (await ctx.request("/conversations?limit=10", u.id)).json();
    expect(list.items.map((c: { title: string }) => c.title)).toEqual(["Baru"]);
    expect((await ctx.request(`/conversations/${conv.id}`, u.id, { method: "DELETE" })).status).toBe(200);
    expect((await (await ctx.request("/conversations", u.id)).json()).items).toHaveLength(0);
  });

  it("validates message bodies", async () => {
    const { u, conv } = await setup();
    expect((await send(u.id, conv.id, "   ")).status).toBe(400);
    expect((await send(u.id, "not-a-uuid", "hi")).status).toBe(400);
  });
});
