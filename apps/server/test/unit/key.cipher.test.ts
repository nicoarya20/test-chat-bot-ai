import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, lastFour } from "../../src/keys/key.cipher";

const key = randomBytes(32).toString("base64"); // test-only
const otherKey = randomBytes(32).toString("base64"); // test-only

describe("key cipher", () => {
  it("round-trips a secret", () => {
    const payload = encryptSecret("sk-ant-test-123456", key);
    expect(decryptSecret(payload, key)).toBe("sk-ant-test-123456");
  });

  it("does not contain the plaintext and uses a fresh IV each time", () => {
    const a = encryptSecret("sk-ant-secret", key);
    const b = encryptSecret("sk-ant-secret", key);
    expect(a).not.toContain("sk-ant-secret");
    expect(a).not.toBe(b);
  });

  it("rejects a wrong key", () => {
    const payload = encryptSecret("sk-ant-secret", key);
    expect(() => decryptSecret(payload, otherKey)).toThrow(/Failed to decrypt secret/);
  });

  it("rejects tampered ciphertext", () => {
    const [v, iv, tag, ct] = encryptSecret("sk-ant-secret", key).split(":");
    const flipped = Buffer.from(ct!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"), key)).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptSecret("garbage", key)).toThrow(/Malformed/);
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => encryptSecret("x", Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });

  it("returns the last four characters", () => {
    expect(lastFour("sk-ant-abcd1234")).toBe("1234");
  });
});
