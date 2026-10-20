import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui/display";
import { getCandidateDashboard } from "@/features/applications/service";
import { formatDateTime, formatRelative, label } from "@/lib/format";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Candidate dashboard" };

export default async function CandidateDashboardPage() {
  const user = await requirePageUser(["CANDIDATE"], "/candidate");
  const data = await getCandidateDashboard(user);
  const active = (data.counts.APPLIED ?? 0) + (data.counts.SHORTLISTED ?? 0) + (data.counts.INTERVIEW ?? 0);

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Here is where your job search stands." actions={<LinkButton href="/jobs">Find jobs</LinkButton>} />

      {!data.profileComplete ? (
        <Alert tone="info" className="mb-6">
          Complete your <Link href="/candidate/profile">profile</Link> (headline, location, skills) and <Link href="/candidate/resumes">upload a resume</Link> so recruiters can evaluate your applications.
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Applications" value={data.total} />
        <StatCard label="In progress" value={active} hint="Applied, shortlisted or interviewing" />
        <StatCard label="Offers" value={(data.counts.OFFERED ?? 0) + (data.counts.HIRED ?? 0)} />
        <StatCard label="Saved jobs" value={data.savedCount} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Recent activity" actions={<Link href="/candidate/applications" className="text-sm">View all</Link>} bodyClassName="p-0">
          {data.recent.length ? (
            <ul className="divide-y divide-slate-100">
              {data.recent.map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/candidate/applications/${app.id}`} className="block truncate text-sm font-medium">
                      {app.job.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {app.job.company.name} · updated {formatRelative(app.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState title="No applications yet" description="Browse open roles and apply in a few clicks." action={<LinkButton href="/jobs">Browse jobs</LinkButton>} />
            </div>
          )}
        </Card>

        <Card title="Upcoming interviews" bodyClassName="p-0">
          {data.upcomingInterviews.length ? (
            <ul className="divide-y divide-slate-100">
              {data.upcomingInterviews.map((interview) => (
                <li key={interview.id} className="px-5 py-3">
                  <Link href={`/candidate/applications/${interview.application.id}`} className="text-sm font-medium">
                    {interview.application.job.title} — {interview.application.job.company.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(interview.startsAt)} · {label(interview.mode)} · {interview.durationMinutes} min
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-slate-600">No interviews scheduled.</p>
          )}
        </Card>
      </div>
    </>
  );
}
