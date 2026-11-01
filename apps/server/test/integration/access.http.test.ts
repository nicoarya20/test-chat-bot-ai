import { beforeEach, describe, expect, it } from "bun:test";
import { buildTestApp } from "../helpers/app";
import { createUser, resetDb } from "../helpers/db";

describe("access control", () => {
  beforeEach(resetDb);
  const { request } = buildTestApp();

  it("returns 401 without a session", async () => {
    expect((await request("/me", null)).status).toBe(401);
    expect((await request("/conversations", null)).status).toBe(401);
  });

  it("returns 401 when the session points to a deleted user", async () => {
    expect((await request("/me", "ghost")).status).toBe(401);
  });

  it("lets pending users read /me but not chat", async () => {
    const u = await createUser({ status: "pending" });
    const me = await request("/me", u.id);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ user: { status: "pending" }, quota: null });
    const conv = await request("/conversations", u.id);
    expect(conv.status).toBe(403);
    expect(await conv.json()).toMatchObject({ error: "not_approved", status: "pending" });
  });

  it("blocks rejected users from chat", async () => {
    const u = await createUser({ status: "rejected" });
    expect((await request("/conversations", u.id)).status).toBe(403);
  });

  it("returns quota on /me for approved users", async () => {
    const u = await createUser();
    const body = await (await request("/me", u.id)).json();
    expect(body.quota).toMatchObject({ allowed: true, sessionLimit: 50000, weeklyLimit: 500000 });
  });

  it("forbids admin routes for regular users", async () => {
    const u = await createUser();
    expect((await request("/admin/users", u.id)).status).toBe(403);
    expect((await request("/admin/settings", u.id)).status).toBe(403);
    expect((await request("/admin/keys", u.id)).status).toBe(403);
  });

  it("forbids admin routes for an admin who is not approved", async () => {
    const u = await createUser({ role: "admin", status: "pending" });
    expect((await request("/admin/users", u.id)).status).toBe(403);
  });

  it("reflects approval immediately without re-login", async () => {
    const admin = await createUser({ role: "admin" });
    const u = await createUser({ status: "pending" });
    const res = await request(`/admin/users/${u.id}`, admin.id, {
      method: "PATCH", body: JSON.stringify({ status: "approved" }),
    });
    expect(res.status).toBe(200);
    expect((await request("/conversations", u.id)).status).toBe(200);
  });
});
