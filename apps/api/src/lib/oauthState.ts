import { randomBytes } from "node:crypto";
import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "./prisma.js";

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Single-use, short-lived CSRF state for the OAuth authorization-code
 * flow. Stored server-side (not just signed) so it can only ever be
 * consumed once — protects against authorization-code injection.
 */
export async function createOAuthState(
  provider: IntegrationProvider,
  codeVerifier?: string,
): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await prisma.oAuthState.create({
    data: {
      state,
      provider,
      codeVerifier,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    },
  });
  return state;
}

export async function consumeOAuthState(
  state: string,
  provider: IntegrationProvider,
): Promise<{ codeVerifier: string | null }> {
  const row = await prisma.oAuthState.findUnique({ where: { state } });

  // Delete-on-read regardless of outcome so a replayed state can never
  // succeed twice, even if validation below fails.
  if (row) {
    await prisma.oAuthState.delete({ where: { id: row.id } }).catch(() => undefined);
  }

  if (!row || row.provider !== provider || row.expiresAt < new Date()) {
    throw new Error("invalid or expired OAuth state");
  }

  return { codeVerifier: row.codeVerifier };
}
