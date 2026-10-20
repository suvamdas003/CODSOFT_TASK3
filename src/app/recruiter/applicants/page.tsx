import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/filter-bar";
import { listApplicants } from "@/features/applications/service";
import { listOwnJobOptions } from "@/features/recruiters/service";
import { APPLICATION_STATUSES, formatDate, label, optionsFor } from "@/lib/format";
import { enumParam, param, parsePage, type SearchParams } from "@/lib/utils";
import { idField } from "@/lib/validation";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Applicants" };

const SORTS = ["newest", "oldest", "experience"] as const;

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(["RECRUITER"], "/recruiter/applicants");
  const sp = await searchParams;
  const jobIdRaw = param(sp.jobId);
  const filters = {
    jobId: jobIdRaw && idField.safeParse(jobIdRaw).success ? jobIdRaw : undefined,
    status: enumParam(sp.status, APPLICATION_STATUSES),
    q: param(sp.q),
    skill: param(sp.skill),
    sort: enumParam(sp.sort, SORTS) ?? "newest",
    page: parsePage(sp.page),
  };
  const [result, jobs] = await Promise.all([listApplicants(user, filters), listOwnJobOptions(user)]);
  const total = Object.values(result.counts).reduce((s, n) => s + (n ?? 0), 0);
  const { page: _p, ...params } = filters;
  void _p;

  return (
    <>
      <PageHeader title="Applicants" description="Filter candidates across your jobs and move them through the pipeline." />

      <div className="mb-4 flex flex-wrap gap-2" role="list" aria-label="Status filter">
        {[undefined, ...APPLICATION_STATUSES].map((status) => {
          const count = status ? (result.counts[status] ?? 0) : total;
          const active = filters.status === status;
          const query = new URLSearchParams({ ...(filters.jobId ? { jobId: filters.jobId } : {}), ...(status ? { status } : {}) });
          return (
            <Link
              key={status ?? "all"}
              role="listitem"
              href={`/recruiter/applicants${query.size ? `?${query}` : ""}`}
              aria-current={active ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-sm no-underline ${active ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
            >
              {status ? label(status) : "All"} <span className="tabular-nums text-slate-500">{count}</span>
            </Link>
          );
        })}
      </div>

      <FilterBar action="/recruiter/applicants" resetHref="/recruiter/applicants">
        <FilterSelect label="Job" name="jobId" defaultValue={filters.jobId} options={jobs.map((j) => ({ value: j.id, label: `${j.title}${j.status !== "PUBLISHED" ? ` (${label(j.status)})` : ""}` }))} allLabel="All jobs" className="w-full sm:w-64" />
        <FilterSelect label="Status" name="status" defaultValue={filters.status} options={optionsFor(APPLICATION_STATUSES)} />
        <FilterInput label="Candidate" name="q" defaultValue={filters.q} placeholder="Name, email or headline" />
        <FilterInput label="Skill" name="skill" defaultValue={filters.skill} placeholder="e.g. React" className="w-full sm:w-36" />
        <FilterSelect
          label="Sort"
          name="sort"
          defaultValue={filters.sort}
          allLabel={null}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "experience", label: "Most experienced" },
          ]}
        />
      </FilterBar>

      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Experience</th>
                <th>Applied</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((app) => (
                <tr key={app.id}>
                  <td>
                    <Link href={`/recruiter/applications/${app.id}`} className="font-medium">
                      {app.candidate.name}
                    </Link>
                    <p className="text-xs text-slate-500">{app.candidate.candidateProfile?.headline ?? "No headline"}</p>
                    {app.candidate.candidateProfile?.skills.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {app.candidate.candidateProfile.skills.slice(0, 4).map((s) => (
                          <Badge key={s}>{s}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/recruiter/jobs/${app.job.id}`}>{app.job.title}</Link>
                  </td>
                  <td className="whitespace-nowrap">
                    {app.candidate.candidateProfile?.experienceYears != null ? `${app.candidate.candidateProfile.experienceYears} yrs` : "—"}
                    <p className="text-xs text-slate-500">{app.candidate.candidateProfile?.location ?? ""}</p>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(app.createdAt)}</td>
                  <td>
                    <StatusBadge status={app.status} />
                    {!app.resumeId ? <p className="mt-1 text-xs text-slate-500">No resume</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No applicants found" description="Applicants appear here as soon as candidates apply to your published jobs." />
      )}
      <Pagination basePath="/recruiter/applicants" page={result.page} pageSize={result.pageSize} total={result.total} params={params} />
    </>
  );
}
