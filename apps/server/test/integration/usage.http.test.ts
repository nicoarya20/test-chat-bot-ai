import { beforeEach, describe, expect, it } from "bun:test";
import { usageLogs } from "../../src/db/schema";
import { buildTestApp } from "../helpers/app";
import { createUser, resetDb } from "../helpers/db";

const HOUR = 3_600_000;

describe("usage API", () => {
  let ctx: ReturnType<typeof buildTestApp>;
  beforeEach(async () => { await resetDb(); ctx = buildTestApp(); });

  async function log(userId: string, model: string, input: number, output: number, ago = 0) {
    await ctx.db.insert(usageLogs).values({
      userId, model, inputTokens: input, outputTokens: output, totalTokens: input + output,
      createdAt: new Date(Date.now() - ago),
    });
  }

  it("returns the user's own totals, zero-filled daily series and model breakdown", async () => {
    const u = await createUser();
    const other = await createUser();
    await log(u.id, "m/a", 100, 50);
    await log(u.id, "m/b", 10, 5);
    await log(u.id, "m/a", 1000, 0, 40 * 24 * HOUR); // outside 30 days and this month/week
    await log(other.id, "m/a", 999, 999);

    const res = await ctx.request("/me/usage?days=7", u.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(7);
    expect(body.totals.today).toEqual({ totalTokens: 165, requests: 2 });
    expect(body.daily).toHaveLength(7);
    expect(body.daily.at(-1)).toMatchObject({ inputTokens: 110, outputTokens: 55, totalTokens: 165, requests: 2 });
    expect(body.daily.slice(0, -1).every((d: { totalTokens: number }) => d.totalTokens === 0)).toBe(true);
    expect(body.byModel).toEqual([
      { model: "m/a", inputTokens: 100, outputTokens: 50, totalTokens: 150, requests: 1 },
      { model: "m/b", inputTokens: 10, outputTokens: 5, totalTokens: 15, requests: 1 },
    ]);
    expect(body.quota).toMatchObject({ sessionLimit: 50000 });
    expect(body).not.toHaveProperty("topUsers");
  });

  it("blocks pending users from usage", async () => {
    const u = await createUser({ status: "pending" });
    expect((await ctx.request("/me/usage", u.id)).status).toBe(403);
  });

  it("validates the range", async () => {
    const u = await createUser();
    expect((await ctx.request("/me/usage?days=0", u.id)).status).toBe(400);
    expect((await ctx.request("/me/usage?days=91", u.id)).status).toBe(400);
  });

  it("gives admins totals across users and the heaviest users", async () => {
    const admin = await createUser({ role: "admin" });
    const a = await createUser();
    const b = await createUser();
    await log(a.id, "m/a", 300, 100);
    await log(b.id, "m/a", 50, 50);
    await log(b.id, "m/b", 10, 0);

    const body = await (await ctx.request("/admin/usage?days=30", admin.id)).json();
    expect(body.totals.today).toEqual({ totalTokens: 510, requests: 3 });
    expect(body.daily).toHaveLength(30);
    expect(body.topUsers.map((u: { userId: string; totalTokens: number }) => [u.userId, u.totalTokens])).toEqual([[a.id, 400], [b.id, 110]]);
    expect(body.byModel[0]).toMatchObject({ model: "m/a", totalTokens: 500, requests: 2 });
  });

  it("forbids the admin usage view for regular users", async () => {
    const u = await createUser();
    expect((await ctx.request("/admin/usage", u.id)).status).toBe(403);
  });
});
