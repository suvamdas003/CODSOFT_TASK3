import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/server/db";

export type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

/** Appends an audit event. Pass the transaction client to make it atomic with the change. */
export async function recordAudit(input: AuditInput, db: Tx = prisma): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
