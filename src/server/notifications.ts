import "server-only";
import type { NotificationType } from "@/generated/prisma/enums";
import { prisma, type Tx } from "@/server/db";
import type { Actor } from "@/server/auth/session";
import { PAGE_SIZE } from "@/lib/utils";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

export async function notify(input: NotifyInput, db: Tx = prisma): Promise<void> {
  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 1000),
      link: input.link,
    },
  });
}

export async function countUnreadNotifications(actor: Actor): Promise<number> {
  return prisma.notification.count({ where: { userId: actor.id, readAt: null } });
}

export async function listNotifications(actor: Actor, page: number) {
  const where = { userId: actor.id };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE };
}

/** Marks one (or, without an id, all) of the actor's notifications as read. */
export async function markNotificationsRead(actor: Actor, notificationId?: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null, ...(notificationId ? { id: notificationId } : {}) },
    data: { readAt: new Date() },
  });
}
