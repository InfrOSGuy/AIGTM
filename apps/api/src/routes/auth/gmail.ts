import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv } from "../../config/env.js";
import { saveIntegrationTokens } from "../../lib/integrationStore.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { consumeOAuthState, createOAuthState } from "../../lib/oauthState.js";
import { deriveCodeChallenge, generateCodeVerifier } from "../../lib/pkce.js";

// Least privilege: compose-only (create/update drafts, never send
// directly) plus metadata-only read (enough to detect a reply exists,
// without ever reading message bodies). No gmail.modify, no full
// gmail.readonly.
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.metadata",
] as const;

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export function registerGmailAuthRoutes(app: FastifyInstance): void {
  app.get("/auth/gmail/start", { preHandler: requireAdmin }, async (_request, reply) => {
    const env = loadEnv();
    const codeVerifier = generateCodeVerifier();
    const state = await createOAuthState("gmail", codeVerifier);

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
    url.searchParams.set("redirect_uri", `${env.APP_BASE_URL}/auth/gmail/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", deriveCodeChallenge(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");

    return reply.redirect(url.toString());
  });

  app.get("/auth/gmail/callback", { preHandler: requireAdmin }, async (request, reply) => {
    const env = loadEnv();
    const parsed = callbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid callback request" });
    }

    const { code, state } = parsed.data;
    let codeVerifier: string | null;
    try {
      ({ codeVerifier } = await consumeOAuthState(state, "gmail"));
    } catch {
      return reply.code(401).send({ error: "invalid or expired OAuth state" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: `${env.APP_BASE_URL}/auth/gmail/callback`,
        grant_type: "authorization_code",
        code_verifier: codeVerifier ?? "",
      }),
    });

    if (!tokenRes.ok) {
      request.log.error({ status: tokenRes.status }, "Gmail token exchange failed");
      return reply.code(502).send({ error: "token exchange failed" });
    }

    const tokenBody = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    await saveIntegrationTokens({
      provider: "gmail",
      accessToken: tokenBody.access_token,
      refreshToken: tokenBody.refresh_token,
      expiresAt: new Date(Date.now() + tokenBody.expires_in * 1000),
      scopes: tokenBody.scope.split(" "),
      actor: "admin",
    });

    return reply.redirect(`${env.ALLOWED_ORIGIN}/integrations?connected=gmail`);
  });
}
