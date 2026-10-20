import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/filter-bar";
import { listRecruiterJobs } from "@/features/jobs/service";
import { formatDate, JOB_STATUSES, label, optionsFor } from "@/lib/format";
import { enumParam, param, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "My jobs" };

export default async function RecruiterJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(["RECRUITER"], "/recruiter/jobs");
  const sp = await searchParams;
  const status = enumParam(sp.status, JOB_STATUSES);
  const q = param(sp.q);
  const result = await listRecruiterJobs(user, { status, q, page: parsePage(sp.page) });

  return (
    <>
      <PageHeader title="Job postings" description="Create, publish, close and manage the jobs you own." actions={<LinkButton href="/recruiter/jobs/new">Post a job</LinkButton>} />
      {sp.deleted ? (
        <Alert tone="success" className="mb-4">
          Job deleted.
        </Alert>
      ) : null}
      <FilterBar action="/recruiter/jobs" resetHref="/recruiter/jobs">
        <FilterInput label="Title" name="q" defaultValue={q} />
        <FilterSelect label="Status" name="status" defaultValue={status} options={optionsFor(JOB_STATUSES)} />
      </FilterBar>
      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th className="text-right">Applicants</th>
                <th className="text-right">Views</th>
                <th>Published</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link href={`/recruiter/jobs/${job.id}`} className="font-medium">
                      {job.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {job.location} · {label(job.employmentType)}
                    </p>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={job.status} />
                      {job.moderationStatus === "REMOVED" ? <Badge tone="red">Removed by moderator</Badge> : null}
                    </div>
                  </td>
                  <td className="text-right tabular-nums">
                    <Link href={`/recruiter/applicants?jobId=${job.id}`}>{job._count.applications}</Link>
                  </td>
                  <td className="text-right tabular-nums">{job.viewCount}</td>
                  <td className="whitespace-nowrap">{formatDate(job.publishedAt)}</td>
                  <td className="whitespace-nowrap">{formatDate(job.applicationDeadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={status || q ? "No jobs match these filters" : "You haven't posted any jobs"}
          action={<LinkButton href="/recruiter/jobs/new">Post a job</LinkButton>}
        />
      )}
      <Pagination basePath="/recruiter/jobs" page={result.page} pageSize={result.pageSize} total={result.total} params={{ status, q }} />
    </>
  );
}
