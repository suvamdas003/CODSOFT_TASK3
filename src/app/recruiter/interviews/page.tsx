import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { listRecruiterInterviews } from "@/features/applications/service";
import { formatDateTime, label } from "@/lib/format";
import { cn, enumParam, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Interviews" };

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(["RECRUITER"], "/recruiter/interviews");
  const sp = await searchParams;
  const scope = enumParam(sp.scope, ["upcoming", "past"] as const) ?? "upcoming";
  const result = await listRecruiterInterviews(user, { scope, page: parsePage(sp.page) });

  return (
    <>
      <PageHeader title="Interviews" description="All interviews scheduled for your applicants. Times are shown in UTC." />
      <div className="mb-4 flex gap-2">
        {(["upcoming", "past"] as const).map((s) => (
          <Link
            key={s}
            href={`/recruiter/interviews${s === "past" ? "?scope=past" : ""}`}
            aria-current={scope === s ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm no-underline", scope === s ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700")}
          >
            {s === "upcoming" ? "Upcoming" : "Past & cancelled"}
          </Link>
        ))}
      </div>
      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>Candidate</th>
                <th>Job</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((interview) => (
                <tr key={interview.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(interview.startsAt)}
                    <p className="text-xs text-slate-500">{interview.durationMinutes} min</p>
                  </td>
                  <td>
                    <Link href={`/recruiter/applications/${interview.application.id}`} className="font-medium">
                      {interview.application.candidate.name}
                    </Link>
                  </td>
                  <td>{interview.application.job.title}</td>
                  <td>
                    {label(interview.mode)}
                    {interview.location ? <p className="max-w-56 truncate text-xs text-slate-500">{interview.location}</p> : null}
                  </td>
                  <td>
                    <StatusBadge status={interview.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={scope === "upcoming" ? "No upcoming interviews" : "No past interviews"} description="Schedule interviews from an applicant's page." />
      )}
      <Pagination basePath="/recruiter/interviews" page={result.page} pageSize={result.pageSize} total={result.total} params={{ scope: scope === "past" ? "past" : undefined }} />
    </>
  );
}
