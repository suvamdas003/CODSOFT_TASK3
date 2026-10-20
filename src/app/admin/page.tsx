import type { Metadata } from "next";
import Link from "next/link";
import { Bar, Card, PageHeader, StatCard } from "@/components/ui/display";
import { getPlatformMetrics } from "@/features/admin/service";
import { APPLICATION_STATUSES, formatRelative, label } from "@/lib/format";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminDashboardPage() {
  const user = await requirePageUser(["ADMIN"], "/admin");
  const m = await getPlatformMetrics(user);
  const totalUsers = (m.users.CANDIDATE ?? 0) + (m.users.RECRUITER ?? 0) + (m.users.ADMIN ?? 0);
  const maxDaily = Math.max(1, ...m.daily.map((d) => d.count));
  const maxStatus = Math.max(0, ...Object.values(m.applications).map(Number));

  return (
    <>
      <PageHeader title="Platform overview" description="Platform-wide figures computed live from the database." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Users" value={totalUsers} hint={`${m.users.CANDIDATE ?? 0} candidates · ${m.users.RECRUITER ?? 0} recruiters · ${m.newUsers} new in 30 days`} />
        <StatCard label="Published jobs" value={m.jobs.PUBLISHED ?? 0} hint={`${m.jobs.DRAFT ?? 0} drafts · ${m.jobs.CLOSED ?? 0} closed · ${m.removedJobs} removed`} />
        <StatCard label="Applications" value={m.totalApplications} hint={`${m.applications.HIRED ?? 0} hires`} />
        <StatCard
          label="Open reports"
          value={m.openReports ? <Link href="/admin/reports?status=OPEN">{m.openReports}</Link> : 0}
          hint={`${m.suspended} suspended accounts`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Applications — last 14 days (UTC)">
          <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`Daily applications: ${m.daily.map((d) => `${d.day} ${d.count}`).join(", ")}`}>
            {m.daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 tabular-nums">{d.count || ""}</span>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.round((d.count / maxDaily) * 120)}px`, minHeight: d.count ? 4 : 1 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            <span>{m.daily[0]?.day}</span>
            <span>{m.daily[m.daily.length - 1]?.day}</span>
          </div>
        </Card>
        <Card title="Applications by status">
          <div className="space-y-2.5">
            {APPLICATION_STATUSES.map((s) => (
              <Bar key={s} label={label(s)} value={m.applications[s] ?? 0} max={maxStatus} />
            ))}
          </div>
        </Card>
        <Card title="Recent administrative activity" className="xl:col-span-2" actions={<Link href="/admin/audit" className="text-sm">Full audit log</Link>} bodyClassName="p-0">
          {m.recentAudit.length ? (
            <ul className="divide-y divide-slate-100">
              {m.recentAudit.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium">{e.actor?.name ?? "System"}</span> <code className="rounded bg-slate-100 px-1 text-xs">{e.action}</code> {e.entityType}
                  </span>
                  <span className="text-xs text-slate-500">{formatRelative(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-slate-600">No events yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
