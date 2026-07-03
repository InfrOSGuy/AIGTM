import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { loadEnv } from "../config/env.js";

const MAX_CLOCK_SKEW_SECONDS = 60 * 5;

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies Slack's request signature per
 * https://api.slack.com/authentication/verifying-requests-from-slack
 * Rejects stale timestamps to prevent replay of captured requests.
 */
export async function verifySlackSignature(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const env = loadEnv();
  const timestamp = request.headers["x-slack-request-timestamp"];
  const signature = request.headers["x-slack-signature"];

  if (typeof timestamp !== "string" || typeof signature !== "string" || !request.rawBody) {
    reply.code(401).send({ error: "missing signature headers" });
    return reply;
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_CLOCK_SKEW_SECONDS) {
    reply.code(401).send({ error: "stale request timestamp" });
    return reply;
  }

  const base = `v0:${timestamp}:${request.rawBody}`;
  const expected = `v0=${createHmac("sha256", env.SLACK_SIGNING_SECRET).update(base).digest("hex")}`;

  if (!timingSafeStringEqual(expected, signature)) {
    reply.code(401).send({ error: "invalid signature" });
    return reply;
  }
}

/**
 * Verifies HubSpot's v3 webhook signature per
 * https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */
export async function verifyHubspotSignature(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const env = loadEnv();
  const timestamp = request.headers["x-hubspot-request-timestamp"];
  const signature = request.headers["x-hubspot-signature-v3"];

  if (typeof timestamp !== "string" || typeof signature !== "string" || !request.rawBody) {
    reply.code(401).send({ error: "missing signature headers" });
    return reply;
  }

  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_CLOCK_SKEW_SECONDS * 1000) {
    reply.code(401).send({ error: "stale request timestamp" });
    return reply;
  }

  const method = request.method.toUpperCase();
  const url = `${env.APP_BASE_URL}${request.url}`;
  const base = `${method}${url}${request.rawBody}${timestamp}`;
  const expected = createHmac("sha256", env.HUBSPOT_WEBHOOK_SIGNING_SECRET)
    .update(base)
    .digest("base64");

  if (!timingSafeStringEqual(expected, signature)) {
    reply.code(401).send({ error: "invalid signature" });
    return reply;
  }
}
