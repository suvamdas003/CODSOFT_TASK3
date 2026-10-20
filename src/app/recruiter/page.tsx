import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Bar, Card, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui/display";
import { getRecruiterStats } from "@/features/recruiters/service";
import { formatDateTime, formatRelative, label, percent, PIPELINE_STATUSES } from "@/lib/format";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Recruiter dashboard" };

const TONES: Record<string, string> = {
  APPLIED: "bg-brand-500",
  SHORTLISTED: "bg-violet-500",
  INTERVIEW: "bg-amber-500",
  OFFERED: "bg-emerald-500",
  HIRED: "bg-emerald-700",
  REJECTED: "bg-red-400",
  WITHDRAWN: "bg-slate-400",
};

export default async function RecruiterDashboardPage() {
  const user = await requirePageUser(["RECRUITER"], "/recruiter");
  const stats = await getRecruiterStats(user);
  const maxStatus = Math.max(0, ...Object.values(stats.appCounts).map(Number));

  return (
    <>
      <PageHeader title="Recruitment overview" description="Live figures from your job postings and applicants." actions={<LinkButton href="/recruiter/jobs/new">Post a job</LinkButton>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Published jobs" value={stats.jobCounts.PUBLISHED ?? 0} hint={`${stats.jobCounts.DRAFT ?? 0} drafts · ${stats.jobCounts.CLOSED ?? 0} closed`} />
        <StatCard label="Applications" value={stats.totalApplications} hint={`${stats.recentApplicationsCount} in the last 30 days`} />
        <StatCard label="Job views" value={stats.totalViews.toLocaleString("en-US")} hint={`Apply rate ${percent(stats.totalApplications, stats.totalViews)}`} />
        <StatCard label="Hires" value={stats.appCounts.HIRED ?? 0} hint={`${stats.appCounts.OFFERED ?? 0} offers outstanding`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Pipeline by status">
          {stats.totalApplications ? (
            <div className="space-y-2.5">
              {[...PIPELINE_STATUSES, "WITHDRAWN" as const].map((status) => (
                <Bar key={status} label={label(status)} value={stats.appCounts[status] ?? 0} max={maxStatus} tone={TONES[status]} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No applications yet.</p>
          )}
        </Card>

        <Card title="Upcoming interviews" actions={<Link href="/recruiter/interviews" className="text-sm">View all</Link>} bodyClassName="p-0">
          {stats.upcomingInterviews.length ? (
            <ul className="divide-y divide-slate-100">
              {stats.upcomingInterviews.map((interview) => (
                <li key={interview.id} className="px-5 py-3">
                  <Link href={`/recruiter/applications/${interview.application.id}`} className="text-sm font-medium">
                    {interview.application.candidate.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {interview.application.job.title} · {formatDateTime(interview.startsAt)} · {label(interview.mode)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-slate-600">No upcoming interviews.</p>
          )}
        </Card>

        <Card title="Job performance" className="xl:col-span-2" bodyClassName="p-0 overflow-x-auto">
          {stats.jobPerformance.length ? (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th className="text-right">Views</th>
                  <th className="text-right">Applications</th>
                  <th className="text-right">Apply rate</th>
                  <th className="text-right">Progressed</th>
                  <th className="text-right">Hired</th>
                </tr>
              </thead>
              <tbody>
                {stats.jobPerformance.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link href={`/recruiter/jobs/${job.id}`} className="font-medium">
                        {job.title}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="text-right tabular-nums">{job.views}</td>
                    <td className="text-right tabular-nums">{job.applications}</td>
                    <td className="text-right tabular-nums">{percent(job.applications, job.views)}</td>
                    <td className="text-right tabular-nums">{job.progressed}</td>
                    <td className="text-right tabular-nums">{job.hired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-5">
              <EmptyState title="No jobs yet" description="Post your first job to start receiving applications." action={<LinkButton href="/recruiter/jobs/new">Post a job</LinkButton>} />
            </div>
          )}
        </Card>

        <Card title="Latest applications" className="xl:col-span-2" bodyClassName="p-0">
          {stats.recentApplications.length ? (
            <ul className="divide-y divide-slate-100">
              {stats.recentApplications.map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/recruiter/applications/${app.id}`} className="text-sm font-medium">
                      {app.candidate.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {app.job.title} · {formatRelative(app.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-slate-600">No applications yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
