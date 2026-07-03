import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv } from "../../config/env.js";
import { saveIntegrationTokens } from "../../lib/integrationStore.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { consumeOAuthState, createOAuthState } from "../../lib/oauthState.js";

// Least privilege for MVP scope (inbound scoring + CRM sync on
// contacts/companies). Deal-write scope is intentionally deferred to
// Phase 2 when the tool actually creates deals — request it then, not now.
const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
] as const;

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export function registerHubspotAuthRoutes(app: FastifyInstance): void {
  app.get("/auth/hubspot/start", { preHandler: requireAdmin }, async (_request, reply) => {
    const env = loadEnv();
    const state = await createOAuthState("hubspot");

    const url = new URL("https://app.hubspot.com/oauth/authorize");
    url.searchParams.set("client_id", env.HUBSPOT_OAUTH_CLIENT_ID);
    url.searchParams.set("redirect_uri", `${env.APP_BASE_URL}/auth/hubspot/callback`);
    url.searchParams.set("scope", HUBSPOT_SCOPES.join(" "));
    url.searchParams.set("state", state);

    return reply.redirect(url.toString());
  });

  app.get("/auth/hubspot/callback", { preHandler: requireAdmin }, async (request, reply) => {
    const env = loadEnv();
    const parsed = callbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid callback request" });
    }

    const { code, state } = parsed.data;
    try {
      await consumeOAuthState(state, "hubspot");
    } catch {
      return reply.code(401).send({ error: "invalid or expired OAuth state" });
    }

    // v1 still works but is deprecated (sunset Feb 2027); new apps should
    // use the date-versioned endpoint per HubSpot's OAuth v3 migration.
    const tokenRes = await fetch("https://api.hubapi.com/oauth/2026-03/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.HUBSPOT_OAUTH_CLIENT_ID,
        client_secret: env.HUBSPOT_OAUTH_CLIENT_SECRET,
        redirect_uri: `${env.APP_BASE_URL}/auth/hubspot/callback`,
        code,
      }),
    });

    if (!tokenRes.ok) {
      request.log.error({ status: tokenRes.status }, "HubSpot token exchange failed");
      return reply.code(502).send({ error: "token exchange failed" });
    }

    const tokenBody = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    await saveIntegrationTokens({
      provider: "hubspot",
      accessToken: tokenBody.access_token,
      refreshToken: tokenBody.refresh_token,
      expiresAt: new Date(Date.now() + tokenBody.expires_in * 1000),
      scopes: [...HUBSPOT_SCOPES],
      actor: "admin",
    });

    return reply.redirect(`${env.ALLOWED_ORIGIN}/integrations?connected=hubspot`);
  });
}
