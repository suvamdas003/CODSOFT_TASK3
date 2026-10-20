import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/display";
import { markNotificationsReadAction } from "@/features/notifications/actions";
import { formatRelative } from "@/lib/format";
import { cn, parsePage, safeRedirectPath, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";
import { listNotifications } from "@/server/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(undefined, "/notifications");
  const result = await listNotifications(user, parsePage((await searchParams).page));
  const hasUnread = result.items.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description="Updates about your applications, jobs and account."
        actions={hasUnread ? <ActionButton action={markNotificationsReadAction} fields={{}}>Mark all as read</ActionButton> : null}
      />
      {result.items.length ? (
        <ul className="card divide-y divide-slate-100">
          {result.items.map((n) => (
            <li key={n.id} className={cn("flex items-start justify-between gap-3 px-5 py-4", !n.readAt && "bg-brand-50/60")}>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {!n.readAt ? <span className="mr-2 inline-block size-2 rounded-full bg-brand-600" aria-label="Unread" /> : null}
                  {n.link ? <Link href={safeRedirectPath(n.link)}>{n.title}</Link> : n.title}
                </p>
                {n.body ? <p className="mt-0.5 text-sm text-slate-600">{n.body}</p> : null}
                <p className="mt-1 text-xs text-slate-500">{formatRelative(n.createdAt)}</p>
              </div>
              {!n.readAt ? (
                <ActionButton action={markNotificationsReadAction} fields={{ notificationId: n.id }} variant="ghost">
                  Mark read
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="You're all caught up" description="New notifications will appear here." />
      )}
      <Pagination basePath="/notifications" page={result.page} pageSize={result.pageSize} total={result.total} />
    </div>
  );
}
