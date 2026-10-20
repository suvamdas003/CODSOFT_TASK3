import type { Metadata } from "next";
import { EmptyState, Pagination } from "@/components/ui/display";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/filter-bar";
import { JobCard } from "@/features/jobs/components/job-card";
import { SaveJobButton } from "@/features/jobs/components/save-job-button";
import { JOB_SORTS, type JobSearchFilters } from "@/features/jobs/schemas";
import { searchJobs } from "@/features/jobs/service";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, optionsFor, WORKPLACE_TYPES } from "@/lib/format";
import { enumParam, param, parsePage, type SearchParams } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Find jobs" };

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "salary_desc", label: "Highest salary" },
  { value: "salary_asc", label: "Lowest salary" },
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const minSalaryRaw = Number(param(sp.minSalary));
  const filters: JobSearchFilters = {
    q: param(sp.q),
    location: param(sp.location),
    company: param(sp.company),
    employmentType: enumParam(sp.employmentType, EMPLOYMENT_TYPES),
    workplaceType: enumParam(sp.workplaceType, WORKPLACE_TYPES),
    experienceLevel: enumParam(sp.experienceLevel, EXPERIENCE_LEVELS),
    minSalary: Number.isInteger(minSalaryRaw) && minSalaryRaw > 0 ? minSalaryRaw : undefined,
    sort: enumParam(sp.sort, JOB_SORTS) ?? "newest",
    page: parsePage(sp.page),
  };
  const viewer = await getCurrentUser();
  const result = await searchJobs(filters, viewer);
  const { page: _page, ...queryParams } = filters;
  void _page;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Find jobs</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        {result.total.toLocaleString("en-US")} open {result.total === 1 ? "position" : "positions"}
        {filters.q ? ` matching “${filters.q}”` : ""}
      </p>

      <FilterBar action="/jobs" resetHref="/jobs">
        <FilterInput label="Keyword" name="q" defaultValue={filters.q} placeholder="Title, skill or company" />
        <FilterInput label="Location" name="location" defaultValue={filters.location} placeholder="City or country" className="w-full sm:w-44" />
        <FilterInput label="Company" name="company" defaultValue={filters.company} className="w-full sm:w-40" />
        <FilterSelect label="Employment type" name="employmentType" defaultValue={filters.employmentType} options={optionsFor(EMPLOYMENT_TYPES)} />
        <FilterSelect label="Workplace" name="workplaceType" defaultValue={filters.workplaceType} options={optionsFor(WORKPLACE_TYPES)} className="w-full sm:w-36" />
        <FilterSelect label="Experience" name="experienceLevel" defaultValue={filters.experienceLevel} options={optionsFor(EXPERIENCE_LEVELS)} className="w-full sm:w-36" />
        <FilterInput label="Min. salary" name="minSalary" type="number" defaultValue={filters.minSalary} className="w-full sm:w-32" />
        <FilterSelect label="Sort by" name="sort" defaultValue={filters.sort} options={SORT_OPTIONS} allLabel={null} className="w-full sm:w-40" />
      </FilterBar>

      {result.items.length ? (
        <div className="space-y-3">
          {result.items.map((job) => (
            <JobCard key={job.id} job={job} action={viewer?.role === "CANDIDATE" ? <SaveJobButton jobId={job.id} saved={job.isSaved} /> : undefined} />
          ))}
        </div>
      ) : (
        <EmptyState title="No jobs match your filters" description="Try a broader keyword, a different location or remove some filters." />
      )}
      <Pagination basePath="/jobs" page={result.page} pageSize={result.pageSize} total={result.total} params={queryParams} />
    </div>
  );
}
