import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Append-only record of sensitive actions: integration connect/disconnect,
 * outreach approval/send, ICP changes. Written best-effort — a logging
 * failure must never block or reverse the underlying action, but every
 * call site listed in SECURITY.md is expected to have one of these.
 */
export async function recordAuditEvent(entry: {
  actor: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor: entry.actor,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
