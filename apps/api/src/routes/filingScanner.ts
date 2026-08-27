import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadEnv } from "../config/env.js";
import { createApolloEnricher, createNullEnricher } from "../integrations/apollo.js";
import { createKnockSender, createNullNotificationSender } from "../integrations/knock.js";
import { createNullSyftClient } from "../integrations/syft.js";
import { createAnthropicClassifier } from "../filingScanner/extract.js";
import { type FilingScanDeps, runFilingScan } from "../filingScanner/pipeline.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const DEFAULT_FORMS = ["10-K", "10-Q", "8-K"];
const DEFAULT_LOOKBACK_DAYS = 7;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const scanBodySchema = z.object({
  forms: z.array(z.string()).min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxFilingsPerPhrase: z.number().int().positive().max(50).optional(),
});

const signalsQuerySchema = z.object({
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  reviewed: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const reviewParamsSchema = z.object({ id: z.string().min(1) });
const reviewBodySchema = z.object({ relevant: z.boolean() });

/**
 * Builds the pipeline's dependencies from configured env vars,
 * degrading gracefully (null/no-op adapters) for anything not
 * configured rather than failing the whole scan — see
 * docs/PRD-IT-INFRA-SCANNER.md §5/§10 on HubSpot/Syft not blocking
 * the rest of the pipeline.
 */
function buildScanDeps(): FilingScanDeps {
  const env = loadEnv();

  const enricher = env.APOLLO_API_KEY ? createApolloEnricher(env.APOLLO_API_KEY) : createNullEnricher();

  const notifier =
    env.KNOCK_API_KEY && env.KNOCK_WORKFLOW_KEY
      ? createKnockSender({
          apiKey: env.KNOCK_API_KEY,
          workflowKey: env.KNOCK_WORKFLOW_KEY,
          recipients: env.KNOCK_RECIPIENT_IDS?.split(",").map((id) => id.trim()) ?? [],
        })
      : createNullNotificationSender();

  // Syft's real client isn't implemented yet (see integrations/syft.ts)
  // — always use the null client here until that lands.
  const syft = createNullSyftClient();

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured — the filing scanner needs it to classify signals");
  }
  const classifier = createAnthropicClassifier(env.ANTHROPIC_API_KEY);

  return { classifier, enricher, syft, notifier };
}

export function registerFilingScannerRoutes(app: FastifyInstance): void {
  app.post("/filing-scanner/scan", { preHandler: requireAdmin }, async (request, reply) => {
    const env = loadEnv();
    if (!env.SEC_EDGAR_USER_AGENT || !env.ANTHROPIC_API_KEY) {
      return reply.code(503).send({
        error: "filing scanner is not configured — set SEC_EDGAR_USER_AGENT and ANTHROPIC_API_KEY",
      });
    }

    const parsedBody = scanBodySchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.code(400).send({ error: "invalid scan request", issues: parsedBody.error.issues });
    }

    const now = new Date();
    const defaultStart = new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    let deps: FilingScanDeps;
    try {
      deps = buildScanDeps();
    } catch (err) {
      request.log.error({ err }, "filing scanner misconfigured");
      return reply.code(503).send({ error: "filing scanner is not configured" });
    }

    try {
      const summary = await runFilingScan(
        {
          forms: parsedBody.data.forms ?? DEFAULT_FORMS,
          startDate: parsedBody.data.startDate ?? toIsoDate(defaultStart),
          endDate: parsedBody.data.endDate ?? toIsoDate(now),
          userAgent: env.SEC_EDGAR_USER_AGENT,
          maxFilingsPerPhrase: parsedBody.data.maxFilingsPerPhrase,
        },
        deps,
      );
      return reply.send(summary);
    } catch (err) {
      request.log.error({ err }, "filing scan failed");
      return reply.code(502).send({ error: "filing scan failed" });
    }
  });

  app.get("/filing-scanner/signals", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = signalsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid query", issues: parsed.error.issues });
    }
    const { minScore, reviewed, limit } = parsed.data;

    const signals = await prisma.filingSignal.findMany({
      where: {
        score: minScore !== undefined ? { gte: minScore } : undefined,
        reviewedRelevant: reviewed === undefined ? undefined : reviewed === "true",
      },
      orderBy: { score: "desc" },
      take: limit,
      include: { filing: { include: { company: true } } },
    });

    return reply.send({ signals });
  });

  app.post("/filing-scanner/signals/:id/review", { preHandler: requireAdmin }, async (request, reply) => {
    const parsedParams = reviewParamsSchema.safeParse(request.params);
    const parsedBody = reviewBodySchema.safeParse(request.body);
    if (!parsedParams.success || !parsedBody.success) {
      return reply.code(400).send({ error: "invalid review request" });
    }

    try {
      const updated = await prisma.filingSignal.update({
        where: { id: parsedParams.data.id },
        data: { reviewedRelevant: parsedBody.data.relevant, reviewedAt: new Date() },
      });
      return reply.send({ signal: updated });
    } catch {
      return reply.code(404).send({ error: "signal not found" });
    }
  });
}
