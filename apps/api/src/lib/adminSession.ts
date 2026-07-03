import { createHmac, timingSafeEqual } from "node:crypto";
import { loadEnv } from "../config/env.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — short enough that a
// leaked cookie has a bounded blast radius; re-auth is one token paste.

export const ADMIN_SESSION_COOKIE = "aigtm_session";

function sign(payload: string): string {
  const env = loadEnv();
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

export function issueAdminSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = sign(payload);

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  const [role, expiresAtRaw] = payload.split(".");
  if (role !== "admin") return false;

  const expiresAt = Number(expiresAtRaw);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}
