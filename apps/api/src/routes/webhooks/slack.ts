import type { FastifyInstance } from "fastify";
import { verifySlackSignature } from "../../middleware/verifyWebhookSignature.js";

export function registerSlackWebhookRoutes(app: FastifyInstance): void {
  app.post(
    "/webhooks/slack/events",
    { preHandler: verifySlackSignature },
    async (request, reply) => {
      const body = request.body as { type?: string; challenge?: string };

      // Slack URL verification handshake, done once when the endpoint is registered.
      if (body.type === "url_verification") {
        return reply.send({ challenge: body.challenge });
      }

      // Actual event handling (interactive actions, etc.) is intentionally
      // not wired up yet — this is the verified entry point for Phase 1
      // Slack alert interactivity to build on.
      request.log.info({ eventType: body.type }, "received verified Slack event");
      return reply.code(200).send({ ok: true });
    },
  );
}
