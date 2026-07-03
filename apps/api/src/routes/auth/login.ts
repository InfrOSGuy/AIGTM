import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv } from "../../config/env.js";
import { ADMIN_SESSION_COOKIE, issueAdminSessionToken } from "../../lib/adminSession.js";
import { recordAuditEvent } from "../../lib/audit.js";

const loginSchema = z.object({ token: z.string().min(1) });

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function registerLoginRoutes(app: FastifyInstance): void {
  // Rate-limited more tightly than the global default (see index.ts) —
  // this is the one endpoint that accepts a guessable-length secret.
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const env = loadEnv();
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid request" });
      }

      if (!timingSafeStringEqual(parsed.data.token, env.ADMIN_API_TOKEN)) {
        await recordAuditEvent({
          actor: "unknown",
          action: "auth.login_failed",
          targetType: "AdminSession",
        });
        return reply.code(401).send({ error: "invalid token" });
      }

      reply.setCookie(ADMIN_SESSION_COOKIE, issueAdminSessionToken(), {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 12 * 60 * 60,
      });

      await recordAuditEvent({
        actor: "admin",
        action: "auth.login_succeeded",
        targetType: "AdminSession",
      });

      return reply.send({ ok: true });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    reply.clearCookie(ADMIN_SESSION_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });
}
