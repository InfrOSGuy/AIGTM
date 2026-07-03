import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.ALLOWED_ORIGIN = "http://localhost:5173";
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/aigtm_test";
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.SESSION_SECRET = randomBytes(32).toString("hex");
  process.env.ADMIN_API_TOKEN = randomBytes(32).toString("hex");
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-google-client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-google-client-secret";
  process.env.SLACK_CLIENT_ID = "test-slack-client-id";
  process.env.SLACK_CLIENT_SECRET = "test-slack-client-secret";
  process.env.SLACK_SIGNING_SECRET = "test-slack-signing-secret";
});

describe("tokenCipher", () => {
  it("round-trips plaintext through encrypt/decrypt", async () => {
    const { encryptSecret, decryptSecret } = await import("../src/crypto/tokenCipher.js");
    const plaintext = "ya29.a0Af-fake-oauth-refresh-token";

    const packed = encryptSecret(plaintext);
    expect(packed).not.toContain(plaintext);
    expect(decryptSecret(packed)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const { encryptSecret } = await import("../src/crypto/tokenCipher.js");
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext instead of returning garbage", async () => {
    const { encryptSecret, decryptSecret } = await import("../src/crypto/tokenCipher.js");
    const packed = encryptSecret("sensitive-value");
    const [version, iv, payload] = packed.split(":");
    const tamperedPayload = Buffer.from(payload!, "base64");
    tamperedPayload[0] = tamperedPayload[0]! ^ 0xff;

    const tampered = [version, iv, tamperedPayload.toString("base64")].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects an unrecognized format instead of silently failing open", async () => {
    const { decryptSecret } = await import("../src/crypto/tokenCipher.js");
    expect(() => decryptSecret("not-a-valid-packed-secret")).toThrow();
  });
});
