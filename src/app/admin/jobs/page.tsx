import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-form";
import { Badge, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/filter-bar";
import { moderateJobAction } from "@/features/admin/actions";
import { RemoveJobForm } from "@/features/admin/components/admin-forms";
import { listJobsForModeration } from "@/features/admin/service";
import { formatDate, JOB_STATUSES, optionsFor } from "@/lib/format";
import { enumParam, param, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Job moderation" };

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requirePageUser(["ADMIN"], "/admin/jobs");
  const sp = await searchParams;
  const filters = {
    q: param(sp.q),
    status: enumParam(sp.status, JOB_STATUSES),
    moderation: enumParam(sp.moderation, ["ACTIVE", "REMOVED"] as const),
    reported: param(sp.reported) === "1",
    page: parsePage(sp.page),
  };
  const result = await listJobsForModeration(admin, filters);

  return (
    <>
      <PageHeader title="Job moderation" description="Remove inappropriate or fraudulent listings. Removed jobs are hidden from candidates and cannot be republished." />
      <FilterBar action="/admin/jobs" resetHref="/admin/jobs">
        <FilterInput label="Search" name="q" defaultValue={filters.q} placeholder="Title or company" />
        <FilterSelect label="Status" name="status" defaultValue={filters.status} options={optionsFor(JOB_STATUSES)} />
        <FilterSelect label="Moderation" name="moderation" defaultValue={filters.moderation} options={[{ value: "ACTIVE", label: "Visible" }, { value: "REMOVED", label: "Removed" }]} />
        <FilterSelect label="Reports" name="reported" defaultValue={filters.reported ? "1" : ""} options={[{ value: "1", label: "With open reports" }]} allLabel="Any" />
      </FilterBar>
      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Job</th>
                <th>Posted by</th>
                <th>Status</th>
                <th className="text-right">Applicants</th>
                <th>Created</th>
                <th className="text-right">Moderation</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link href={`/jobs/${job.id}`} className="font-medium">
                      {job.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {job.company.name}
                      {job.company.verified ? " ✓" : ""}
                    </p>
                    {job._count.reports ? (
                      <Link href="/admin/reports?status=OPEN" className="mt-1 inline-block">
                        <Badge tone="amber">{job._count.reports} open report{job._count.reports === 1 ? "" : "s"}</Badge>
                      </Link>
                    ) : null}
                  </td>
                  <td>
                    <p>{job.postedBy.name}</p>
                    <p className="text-xs text-slate-500">{job.postedBy.email}</p>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={job.status} />
                      {job.moderationStatus === "REMOVED" ? <StatusBadge status="REMOVED" /> : null}
                    </div>
                    {job.moderationReason ? <p className="mt-1 max-w-48 text-xs text-slate-500">{job.moderationReason}</p> : null}
                  </td>
                  <td className="text-right tabular-nums">{job._count.applications}</td>
                  <td className="whitespace-nowrap">{formatDate(job.createdAt)}</td>
                  <td className="text-right">
                    {job.moderationStatus === "REMOVED" ? (
                      <ActionButton action={moderateJobAction} fields={{ jobId: job.id, decision: "RESTORE" }} variant="success">
                        Restore
                      </ActionButton>
                    ) : (
                      <RemoveJobForm jobId={job.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No jobs match these filters" />
      )}
      <Pagination
        basePath="/admin/jobs"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q: filters.q, status: filters.status, moderation: filters.moderation, reported: filters.reported ? "1" : undefined }}
      />
    </>
  );
}
