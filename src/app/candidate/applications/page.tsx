import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { listCandidateApplications } from "@/features/applications/service";
import { APPLICATION_STATUSES, formatDate, optionsFor } from "@/lib/format";
import { enumParam, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "My applications" };

export default async function CandidateApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(["CANDIDATE"], "/candidate/applications");
  const sp = await searchParams;
  const status = enumParam(sp.status, APPLICATION_STATUSES);
  const result = await listCandidateApplications(user, { status, page: parsePage(sp.page) });

  return (
    <>
      <PageHeader title="My applications" description="Track the status and history of every application you have submitted." />
      <FilterBar action="/candidate/applications" resetHref="/candidate/applications">
        <FilterSelect label="Status" name="status" defaultValue={status} options={optionsFor(APPLICATION_STATUSES)} />
      </FilterBar>
      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Job</th>
                <th>Company</th>
                <th>Applied</th>
                <th>Last update</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((app) => (
                <tr key={app.id}>
                  <td>
                    <Link href={`/candidate/applications/${app.id}`} className="font-medium">
                      {app.job.title}
                    </Link>
                    <p className="text-xs text-slate-500">{app.job.location}</p>
                  </td>
                  <td>{app.job.company.name}</td>
                  <td className="whitespace-nowrap">{formatDate(app.createdAt)}</td>
                  <td className="whitespace-nowrap">{formatDate(app.updatedAt)}</td>
                  <td>
                    <StatusBadge status={app.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={status ? "No applications with this status" : "You haven't applied to any jobs yet"}
          action={<LinkButton href="/jobs">Browse jobs</LinkButton>}
        />
      )}
      <Pagination basePath="/candidate/applications" page={result.page} pageSize={result.pageSize} total={result.total} params={{ status }} />
    </>
  );
}
