import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

/**
 * Webhook signature verification (Slack, HubSpot) must run over the exact
 * bytes the provider signed, before JSON.parse reorders/normalizes
 * anything. This registers a content-type parser that stashes the raw
 * body on the request alongside the parsed JSON.
 */
export function registerRawBodyCapture(app: FastifyInstance): void {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      req.rawBody = body as string;
      try {
        const json = body ? JSON.parse(body as string) : {};
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
}
