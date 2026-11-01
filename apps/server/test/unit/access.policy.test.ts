import { describe, expect, it } from "bun:test";
import { initialAccess } from "../../src/auth/access.policy";

describe("initialAccess", () => {
  const admins = ["boss@example.test"]; // test-only

  it("makes listed emails approved admins", () => {
    expect(initialAccess("boss@example.test", admins)).toEqual({ role: "admin", status: "approved" });
  });

  it("matches emails case-insensitively", () => {
    expect(initialAccess("  Boss@Example.TEST ", admins).role).toBe("admin");
  });

  it("puts everyone else in pending as a regular user", () => {
    expect(initialAccess("someone@example.test", admins)).toEqual({ role: "user", status: "pending" });
  });

  it("treats an empty admin list as no admins", () => {
    expect(initialAccess("boss@example.test", []).status).toBe("pending");
  });
});
