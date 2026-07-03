import type { FastifyReply, FastifyRequest } from "fastify";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../lib/adminSession.js";

/**
 * Gates every route that can read leads/scores or mutate integration
 * state (start an OAuth flow, approve outreach, change ICP rules).
 * Without this, anyone who can reach the API could hijack an
 * integration connection or read pipeline data.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies?.[ADMIN_SESSION_COOKIE];
  if (!verifyAdminSessionToken(token)) {
    reply.code(401).send({ error: "authentication required" });
    return reply;
  }
}
