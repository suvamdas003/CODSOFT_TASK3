import Link from "next/link";
import { Badge } from "@/components/ui/display";
import { formatRelative, formatSalary, label } from "@/lib/format";
import type { PublicJobListItem } from "@/features/jobs/service";
import type { ReactNode } from "react";

export function JobCard({ job, action }: { job: PublicJobListItem; action?: ReactNode }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  return (
    <article className="card flex flex-col gap-3 p-5 transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h3 className="text-base font-semibold">
          <Link href={`/jobs/${job.id}`} className="text-slate-900 no-underline hover:text-brand-700">
            {job.title}
          </Link>
        </h3>
        <p className="text-sm text-slate-600">
          <Link href={`/companies/${job.company.slug}`} className="font-medium text-slate-700 no-underline hover:underline">
            {job.company.name}
          </Link>
          {job.company.verified ? (
            <span className="ml-1 text-xs text-emerald-700" title="Verified company">
              ✓ Verified
            </span>
          ) : null}
          <span className="mx-1.5 text-slate-300">•</span>
          {job.location}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge tone="blue">{label(job.employmentType)}</Badge>
          <Badge>{label(job.workplaceType)}</Badge>
          <Badge>{label(job.experienceLevel)}</Badge>
          {salary ? <Badge tone="green">{salary}</Badge> : null}
        </div>
        {job.skills.length ? <p className="pt-1 text-xs text-slate-500">{job.skills.slice(0, 6).join(" · ")}</p> : null}
      </div>
      <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
        {job.publishedAt ? <p className="text-xs text-slate-500">{formatRelative(job.publishedAt)}</p> : null}
        {action}
      </div>
    </article>
  );
}
