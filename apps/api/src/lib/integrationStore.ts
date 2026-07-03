import type { IntegrationProvider } from "@prisma/client";
import { encryptSecret } from "../crypto/tokenCipher.js";
import { recordAuditEvent } from "./audit.js";
import { prisma } from "./prisma.js";

export async function saveIntegrationTokens(params: {
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  actor: string;
}): Promise<void> {
  const { provider, accessToken, refreshToken, expiresAt, scopes, actor } = params;

  await prisma.integrationConnection.upsert({
    where: { provider },
    create: {
      provider,
      accessTokenEnc: encryptSecret(accessToken),
      refreshTokenEnc: refreshToken ? encryptSecret(refreshToken) : undefined,
      scopes,
      expiresAt,
    },
    update: {
      accessTokenEnc: encryptSecret(accessToken),
      // Some providers (e.g. Google on re-consent) don't return a refresh
      // token on every exchange — only overwrite if we actually got one.
      ...(refreshToken ? { refreshTokenEnc: encryptSecret(refreshToken) } : {}),
      scopes,
      expiresAt,
      lastRefreshedAt: new Date(),
      revokedAt: null,
    },
  });

  await recordAuditEvent({
    actor,
    action: "integration.connected",
    targetType: "IntegrationConnection",
    targetId: provider,
    metadata: { scopes },
  });
}
