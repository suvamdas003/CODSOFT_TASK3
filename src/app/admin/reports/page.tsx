import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { ResolveReportForm } from "@/features/admin/components/admin-forms";
import { listReports } from "@/features/admin/service";
import { formatDateTime, label, optionsFor, REPORT_STATUSES } from "@/lib/format";
import { enumParam, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Reported content" };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requirePageUser(["ADMIN"], "/admin/reports");
  const sp = await searchParams;
  const status = enumParam(sp.status, REPORT_STATUSES);
  const result = await listReports(admin, { status, page: parsePage(sp.page) });

  return (
    <>
      <PageHeader title="Reported content" description="Listings flagged by users. Resolve, dismiss, or remove the job." />
      <FilterBar action="/admin/reports" resetHref="/admin/reports">
        <FilterSelect label="Status" name="status" defaultValue={status} options={optionsFor(REPORT_STATUSES)} />
      </FilterBar>
      {result.items.length ? (
        <ul className="space-y-3">
          {result.items.map((report) => (
            <li key={report.id} className="card grid gap-4 p-5 md:grid-cols-[1fr_18rem]">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={report.status} />
                  <span className="text-sm font-semibold">{label(report.reason)}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(report.createdAt)}</span>
                </div>
                <p className="text-sm">
                  <Link href={`/jobs/${report.job.id}`} className="font-medium">
                    {report.job.title}
                  </Link>{" "}
                  <span className="text-slate-500">at {report.job.company.name}</span>
                  {report.job.moderationStatus === "REMOVED" ? (
                    <span className="ml-2">
                      <StatusBadge status="REMOVED" />
                    </span>
                  ) : null}
                </p>
                {report.details ? <p className="prose-text rounded-lg bg-slate-50 p-3">{report.details}</p> : null}
                <p className="text-xs text-slate-500">
                  Reported by {report.reporter.name} ({report.reporter.email})
                </p>
                {report.status !== "OPEN" ? (
                  <p className="text-xs text-slate-500">
                    {label(report.status)} by {report.resolvedBy?.name ?? "—"} on {formatDateTime(report.resolvedAt)}
                    {report.resolutionNote ? ` — ${report.resolutionNote}` : ""}
                  </p>
                ) : null}
              </div>
              {report.status === "OPEN" ? <ResolveReportForm reportId={report.id} jobRemoved={report.job.moderationStatus === "REMOVED"} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={status === "OPEN" ? "No open reports" : "No reports"} description="Reports submitted by users appear here." />
      )}
      <Pagination basePath="/admin/reports" page={result.page} pageSize={result.pageSize} total={result.total} params={{ status }} />
    </>
  );
}
