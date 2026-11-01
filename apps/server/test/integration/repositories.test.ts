import { beforeEach, describe, expect, it } from "bun:test";
import { activateKey, createKey, deleteKey, getActiveKeyCiphertext, listKeys } from "../../src/keys/keys.repository";
import { ensureSessionWindow, recordUsage } from "../../src/quota/quota.service";
import { listUsersWithUsage } from "../../src/users/users.repository";
import { testQuota } from "../helpers/app";
import { createUser, resetDb, testDb } from "../helpers/db";

const db = testDb();

describe("keys repository", () => {
  beforeEach(resetDb);

  it("auto-activates only the first key", async () => {
    const admin = await createUser({ role: "admin" });
    const a = await createKey(db, { label: "A", ciphertext: "v1:a", last4: "aaaa", createdBy: admin.id });
    const b = await createKey(db, { label: "B", ciphertext: "v1:b", last4: "bbbb", createdBy: admin.id });
    expect(a.isActive).toBe(true);
    expect(b.isActive).toBe(false);
    expect(await getActiveKeyCiphertext(db)).toBe("v1:a");
  });

  it("switches the active key exclusively", async () => {
    const admin = await createUser({ role: "admin" });
    await createKey(db, { label: "A", ciphertext: "v1:a", last4: "aaaa", createdBy: admin.id });
    const b = await createKey(db, { label: "B", ciphertext: "v1:b", last4: "bbbb", createdBy: admin.id });
    expect(await activateKey(db, b.id)).toBe(true);
    const active = (await listKeys(db)).filter((k) => k.isActive);
    expect(active.map((k) => k.label)).toEqual(["B"]);
    expect(await getActiveKeyCiphertext(db)).toBe("v1:b");
  });

  it("never exposes ciphertext in listings", async () => {
    const admin = await createUser({ role: "admin" });
    await createKey(db, { label: "A", ciphertext: "v1:secret", last4: "aaaa", createdBy: admin.id });
    const [item] = await listKeys(db);
    expect(Object.keys(item!)).not.toContain("ciphertext");
  });

  it("reports missing keys on activate/delete", async () => {
    const missing = "00000000-0000-0000-0000-000000000000";
    expect(await activateKey(db, missing)).toBe(false);
    expect(await deleteKey(db, missing)).toBe(false);
  });

  it("returns null when no key is active", async () => {
    expect(await getActiveKeyCiphertext(db)).toBeNull();
  });
});

describe("listUsersWithUsage", () => {
  beforeEach(resetDb);

  it("aggregates session and weekly usage per user in one page", async () => {
    const a = await createUser();
    const b = await createUser({ status: "pending" });
    await ensureSessionWindow(db, a.id, testQuota);
    await recordUsage(db, { userId: a.id, conversationId: null, model: "m", inputTokens: 70, outputTokens: 30, cacheCreationTokens: 0, cacheReadTokens: 0 });
    const { users, total } = await listUsersWithUsage(db, { limit: 10, offset: 0 }, testQuota);
    expect(total).toBe(2);
    expect(users.find((u) => u.id === a.id)).toMatchObject({ sessionUsed: 100, weeklyUsed: 100 });
    expect(users.find((u) => u.id === b.id)).toMatchObject({ sessionUsed: 0, weeklyUsed: 0 });
  });

  it("filters by status and paginates", async () => {
    await createUser({ status: "pending" });
    await createUser({ status: "pending" });
    await createUser();
    const page = await listUsersWithUsage(db, { status: "pending", limit: 1, offset: 0 }, testQuota);
    expect(page.total).toBe(2);
    expect(page.users).toHaveLength(1);
    expect(page.users[0]!.status).toBe("pending");
  });
});
