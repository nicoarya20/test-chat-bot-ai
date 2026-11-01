import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { providerKeys } from "../../src/db/schema";
import { decryptSecret } from "../../src/keys/key.cipher";
import { buildTestApp, testEncryptionKey } from "../helpers/app";
import { createUser, resetDb } from "../helpers/db";

const FAKE_KEY = "sk-ant-test-0000000000000000wxyz"; // test-only

describe("admin API", () => {
  beforeEach(resetDb);
  const { request, db } = buildTestApp();
  const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

  it("stores API keys encrypted and returns only last4", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await request("/admin/keys", admin.id, json("POST", { label: "Main", apiKey: FAKE_KEY }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toMatchObject({ label: "Main", last4: "wxyz", isActive: true });
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);

    const [row] = await db.select().from(providerKeys).where(eq(providerKeys.id, body.key.id));
    expect(row!.ciphertext).not.toContain(FAKE_KEY);
    expect(decryptSecret(row!.ciphertext, testEncryptionKey)).toBe(FAKE_KEY);

    const list = await (await request("/admin/keys", admin.id)).json();
    expect(JSON.stringify(list)).not.toContain("ciphertext");
  });

  it("rejects too-short API keys", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await request("/admin/keys", admin.id, json("POST", { label: "x", apiKey: "short" }));
    expect(res.status).toBe(400);
  });

  it("updates settings and rejects unsupported models", async () => {
    const admin = await createUser({ role: "admin" });
    const ok = await request("/admin/settings", admin.id, json("PUT", {
      model: "claude-sonnet-5-5", defaultSessionTokenLimit: 1234, systemPrompt: "Jawab dalam bahasa Indonesia.",
    }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).settings).toMatchObject({ model: "claude-sonnet-5-5", defaultSessionTokenLimit: 1234 });
    const bad = await request("/admin/settings", admin.id, json("PUT", { model: "gpt-4" }));
    expect(bad.status).toBe(400);
  });

  it("sets per-user limits and can clear them back to defaults", async () => {
    const admin = await createUser({ role: "admin" });
    const u = await createUser();
    await request(`/admin/users/${u.id}`, admin.id, json("PATCH", { sessionTokenLimit: 10, weeklyTokenLimit: 20 }));
    let me = await (await request("/me", u.id)).json();
    expect(me.quota).toMatchObject({ sessionLimit: 10, weeklyLimit: 20 });
    await request(`/admin/users/${u.id}`, admin.id, json("PATCH", { sessionTokenLimit: null, weeklyTokenLimit: null }));
    me = await (await request("/me", u.id)).json();
    expect(me.quota).toMatchObject({ sessionLimit: 50000, weeklyLimit: 500000 });
  });

  it("prevents admins from changing their own role or status", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await request(`/admin/users/${admin.id}`, admin.id, json("PATCH", { role: "user" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "cannot_change_own_access" });
  });

  it("rejects empty patches and unknown users", async () => {
    const admin = await createUser({ role: "admin" });
    expect((await request(`/admin/users/nope`, admin.id, json("PATCH", {}))).status).toBe(400);
    expect((await request(`/admin/users/nope`, admin.id, json("PATCH", { status: "approved" }))).status).toBe(404);
  });

  it("caps user listing page size", async () => {
    const admin = await createUser({ role: "admin" });
    expect((await request("/admin/users?limit=1000", admin.id)).status).toBe(400);
    const res = await request("/admin/users?status=pending&limit=5", admin.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ users: [], total: 0 });
  });
});
