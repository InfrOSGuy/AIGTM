import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { loadEnv } from "./config/env.js";
import { registerRawBodyCapture } from "./lib/rawBodyPlugin.js";
import { registerGmailAuthRoutes } from "./routes/auth/gmail.js";
import { registerLoginRoutes } from "./routes/auth/login.js";
import { registerSlackAuthRoutes } from "./routes/auth/slack.js";
import { registerSlackWebhookRoutes } from "./routes/webhooks/slack.js";

export async function buildApp(): Promise<FastifyInstance> {
  // Validates env and throws before any server/socket is opened if
  // config is missing or insecure — see config/env.ts.
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      // Never let request/response bodies (which can carry tokens or
      // lead PII) land in logs by default.
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    trustProxy: true,
  });

  registerRawBodyCapture(app);

  await app.register(helmet, { contentSecurityPolicy: env.NODE_ENV === "production" });
  await app.register(cors, { origin: env.ALLOWED_ORIGIN, credentials: true });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  app.get("/health", async () => ({ ok: true }));

  // HubSpot integration is temporarily disabled — it requires a HubSpot
  // plan tier we don't currently have. See docs/SCOPE.md. Re-add
  // registerHubspotAuthRoutes / registerHubspotWebhookRoutes (git history
  // has the implementation) once that's resolved.
  registerLoginRoutes(app);
  registerGmailAuthRoutes(app);
  registerSlackAuthRoutes(app);
  registerSlackWebhookRoutes(app);

  return app;
}
