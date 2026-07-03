import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { loadEnv } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const FORMAT_VERSION = "v1";

/**
 * Encrypts OAuth tokens (and any other secret material) before it is
 * persisted. Ciphertext, IV, and auth tag are packed into one opaque
 * string so callers never handle key material directly.
 *
 * Format: v1:<base64 iv>:<base64 ciphertext+authTag>
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    Buffer.concat([ciphertext, authTag]).toString("base64"),
  ].join(":");
}

export function decryptSecret(packed: string): string {
  const [version, ivB64, payloadB64] = packed.split(":");
  if (version !== FORMAT_VERSION || !ivB64 || !payloadB64) {
    throw new Error("Unrecognized encrypted-secret format");
  }

  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const payload = Buffer.from(payloadB64, "base64");

  const authTag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Throws if the ciphertext or tag was tampered with — GCM gives us
  // integrity, not just confidentiality.
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function getKey(): Buffer {
  const env = loadEnv();
  return Buffer.from(env.TOKEN_ENCRYPTION_KEY, "base64");
}
