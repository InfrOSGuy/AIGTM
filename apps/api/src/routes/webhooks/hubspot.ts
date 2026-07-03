import type { FastifyInstance } from "fastify";
import { verifyHubspotSignature } from "../../middleware/verifyWebhookSignature.js";

export function registerHubspotWebhookRoutes(app: FastifyInstance): void {
  app.post(
    "/webhooks/hubspot",
    { preHandler: verifyHubspotSignature },
    async (request, reply) => {
      // Signature verified in preHandler — safe to trust payload origin.
      // Event processing (contact updated, deal stage changed, etc.) is
      // the next piece to build on top of this verified entry point.
      request.log.info("received verified HubSpot webhook");
      return reply.code(200).send({ ok: true });
    },
  );
}
