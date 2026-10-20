import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, DescriptionList, StatusBadge } from "@/components/ui/display";
import { listResumes } from "@/features/candidates/service";
import { ApplyForm, ReportJobForm } from "@/features/jobs/components/job-detail-forms";
import { SaveJobButton } from "@/features/jobs/components/save-job-button";
import { getJobForViewer, recordJobView } from "@/features/jobs/service";
import { formatDate, formatSalary, label } from "@/lib/format";
import { idField } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!idField.safeParse(id).success) return { title: "Job not found" };
  const data = await getJobForViewer(id, await getCurrentUser());
  return { title: data ? `${data.job.title} at ${data.job.company.name}` : "Job not found" };
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  if (!idField.safeParse(id).success) notFound();
  const viewer = await getCurrentUser();
  const data = await getJobForViewer(id, viewer);
  if (!data) notFound();
  const { job, isPublic, isOwner, application, isSaved, hasReported } = data;
  if (isPublic) await recordJobView(id, viewer);

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const resumes = viewer?.role === "CANDIDATE" && !application ? await listResumes(viewer) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link href="/jobs">← All jobs</Link>
      </nav>

      {!isPublic ? (
        <Alert tone="warning" className="mb-4">
          Preview — this listing is not publicly visible ({job.moderationStatus === "REMOVED" ? `removed by moderation${job.moderationReason ? `: ${job.moderationReason}` : ""}` : label(job.status).toLowerCase()}).
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  <Link href={`/companies/${job.company.slug}`} className="font-medium">
                    {job.company.name}
                  </Link>
                  {job.company.verified ? <span className="ml-1 text-xs text-emerald-700">✓ Verified</span> : null}
                  <span className="mx-1.5 text-slate-300">•</span>
                  {job.location}
                </p>
              </div>
              {viewer?.role === "CANDIDATE" && isPublic ? <SaveJobButton jobId={job.id} saved={isSaved} /> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Badge tone="blue">{label(job.employmentType)}</Badge>
              <Badge>{label(job.workplaceType)}</Badge>
              <Badge>{label(job.experienceLevel)}</Badge>
              {salary ? <Badge tone="green">{salary}</Badge> : null}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5">
              <DescriptionList
                items={[
                  { term: "Posted", value: formatDate(job.publishedAt) },
                  { term: "Apply by", value: job.applicationDeadline ? formatDate(job.applicationDeadline) : "Open until filled" },
                ]}
              />
            </div>
          </div>

          <Card title="About the role">
            <p className="prose-text">{job.description}</p>
          </Card>
          {job.responsibilities ? (
            <Card title="Responsibilities">
              <p className="prose-text">{job.responsibilities}</p>
            </Card>
          ) : null}
          <Card title="Requirements">
            <p className="prose-text">{job.requirements}</p>
            {job.skills.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            ) : null}
          </Card>
          {job.benefits ? (
            <Card title="Benefits">
              <p className="prose-text">{job.benefits}</p>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card title="Apply">
            {!viewer ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Sign in as a candidate to apply for this job.</p>
                <LinkButton href={`/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`} className="w-full">
                  Sign in to apply
                </LinkButton>
                <LinkButton href="/register?role=CANDIDATE" variant="secondary" className="w-full">
                  Create an account
                </LinkButton>
              </div>
            ) : viewer.role !== "CANDIDATE" ? (
              <div className="space-y-3 text-sm text-slate-600">
                <p>Applications are submitted by candidate accounts.</p>
                {isOwner ? (
                  <LinkButton href={`/recruiter/jobs/${job.id}`} className="w-full">
                    Manage this job
                  </LinkButton>
                ) : null}
              </div>
            ) : application ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  You applied to this job. Current status: <StatusBadge status={application.status} />
                </p>
                <LinkButton href={`/candidate/applications/${application.id}`} variant="secondary" className="w-full">
                  View application
                </LinkButton>
              </div>
            ) : isPublic ? (
              <ApplyForm jobId={job.id} resumes={resumes} />
            ) : (
              <p className="text-sm text-slate-600">This job is not accepting applications.</p>
            )}
          </Card>

          <Card title={`About ${job.company.name}`}>
            {job.company.description ? <p className="prose-text line-clamp-6">{job.company.description}</p> : null}
            <div className="mt-3">
              <DescriptionList
                items={[
                  { term: "Industry", value: job.company.industry },
                  { term: "Size", value: job.company.size ? `${job.company.size} employees` : null },
                  { term: "Headquarters", value: job.company.location },
                ]}
              />
            </div>
            <Link href={`/companies/${job.company.slug}`} className="mt-4 inline-block text-sm font-medium">
              View company profile →
            </Link>
          </Card>

          {viewer && isPublic && !isOwner ? (
            <div className="px-1">{hasReported ? <p className="text-xs text-slate-500">You reported this listing. Thank you.</p> : <ReportJobForm jobId={job.id} />}</div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
