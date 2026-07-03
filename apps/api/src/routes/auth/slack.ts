import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv } from "../../config/env.js";
import { saveIntegrationTokens } from "../../lib/integrationStore.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { consumeOAuthState, createOAuthState } from "../../lib/oauthState.js";

// Least privilege: post-only bot scope. No channels:history, no
// users:read.email, nothing that lets the bot read conversations —
// Phase 1 only needs to push alerts and read interactive button clicks
// (handled separately via the signed /webhooks/slack/events endpoint).
const SLACK_BOT_SCOPES = ["chat:write", "chat:write.public"] as const;

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export function registerSlackAuthRoutes(app: FastifyInstance): void {
  app.get("/auth/slack/start", { preHandler: requireAdmin }, async (_request, reply) => {
    const env = loadEnv();
    const state = await createOAuthState("slack");

    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", env.SLACK_CLIENT_ID);
    url.searchParams.set("redirect_uri", `${env.APP_BASE_URL}/auth/slack/callback`);
    url.searchParams.set("scope", SLACK_BOT_SCOPES.join(","));
    url.searchParams.set("state", state);

    return reply.redirect(url.toString());
  });

  app.get("/auth/slack/callback", { preHandler: requireAdmin }, async (request, reply) => {
    const env = loadEnv();
    const parsed = callbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid callback request" });
    }

    const { code, state } = parsed.data;
    try {
      await consumeOAuthState(state, "slack");
    } catch {
      return reply.code(401).send({ error: "invalid or expired OAuth state" });
    }

    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        redirect_uri: `${env.APP_BASE_URL}/auth/slack/callback`,
        code,
      }),
    });

    const tokenBody = (await tokenRes.json()) as {
      ok: boolean;
      error?: string;
      access_token: string;
      scope: string;
    };

    if (!tokenRes.ok || !tokenBody.ok) {
      request.log.error({ error: tokenBody.error }, "Slack token exchange failed");
      return reply.code(502).send({ error: "token exchange failed" });
    }

    await saveIntegrationTokens({
      provider: "slack",
      accessToken: tokenBody.access_token,
      // Slack bot tokens don't expire/rotate via refresh_token in the
      // standard OAuth v2 flow, so there's nothing to store here.
      scopes: tokenBody.scope.split(","),
      actor: "admin",
    });

    return reply.redirect(`${env.ALLOWED_ORIGIN}/integrations?connected=slack`);
  });
}
