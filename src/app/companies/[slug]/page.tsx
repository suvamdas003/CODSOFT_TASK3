import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, DescriptionList, EmptyState } from "@/components/ui/display";
import { JobCard } from "@/features/jobs/components/job-card";
import { getCompanyPage } from "@/features/jobs/service";
import { isHttpUrl } from "@/lib/validation";

type Props = { params: Promise<{ slug: string }> };

function validSlug(slug: string) {
  return /^[a-z0-9-]{1,140}$/.test(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = validSlug(slug) ? await getCompanyPage(slug) : null;
  return { title: data?.company.name ?? "Company not found" };
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  if (!validSlug(slug)) notFound();
  const data = await getCompanyPage(slug);
  if (!data) notFound();
  const { company, jobs } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="card mb-6 p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xl font-bold text-brand-800" aria-hidden>
            {company.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {company.name}
              {company.verified ? <span className="ml-2 align-middle text-sm font-medium text-emerald-700">✓ Verified</span> : null}
            </h1>
            {company.website && isHttpUrl(company.website) ? (
              <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="text-sm">
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
        </div>
        {company.description ? <p className="prose-text mt-4">{company.description}</p> : null}
        <div className="mt-5 border-t border-slate-100 pt-5">
          <DescriptionList
            items={[
              { term: "Industry", value: company.industry },
              { term: "Company size", value: company.size ? `${company.size} employees` : null },
              { term: "Headquarters", value: company.location },
              { term: "Open positions", value: String(jobs.length) },
            ]}
          />
        </div>
      </div>

      <Card title="Open positions" bodyClassName="p-4 space-y-3">
        {jobs.length ? jobs.map((job) => <JobCard key={job.id} job={job} />) : <EmptyState title="No open positions right now" />}
      </Card>
    </div>
  );
}
