import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, DescriptionList, PageHeader, StatCard, StatusBadge } from "@/components/ui/display";
import { listApplicants } from "@/features/applications/service";
import { deleteJobAction, setJobStatusAction } from "@/features/jobs/actions";
import { getOwnedJob } from "@/features/jobs/service";
import { AppError } from "@/lib/errors";
import { formatDate, formatSalary, label, percent, PIPELINE_STATUSES } from "@/lib/format";
import type { SearchParams } from "@/lib/utils";
import { idField } from "@/lib/validation";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Manage job" };

export default async function RecruiterJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const user = await requirePageUser(["RECRUITER"], `/recruiter/jobs/${id}`);
  if (!idField.safeParse(id).success) notFound();
  const job = await getOwnedJob(user, id).catch((error) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const applicants = await listApplicants(user, { jobId: job.id, page: 1 });
  const { created } = await searchParams;
  const removed = job.moderationStatus === "REMOVED";

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <Link href="/recruiter/jobs">← Job postings</Link>
      </nav>
      <PageHeader
        title={job.title}
        description={`${job.location} · ${label(job.employmentType)} · ${label(job.workplaceType)}`}
        actions={
          <>
            <LinkButton href={`/jobs/${job.id}`} variant="ghost" size="sm">
              {job.status === "PUBLISHED" && !removed ? "View public page" : "Preview"}
            </LinkButton>
            <LinkButton href={`/recruiter/jobs/${job.id}/edit`} variant="secondary" size="sm">
              Edit
            </LinkButton>
            {job.status !== "PUBLISHED" && !removed ? (
              <ActionButton action={setJobStatusAction} fields={{ jobId: job.id, status: "PUBLISHED" }} variant="success">
                {job.status === "CLOSED" ? "Reopen" : "Publish"}
              </ActionButton>
            ) : null}
            {job.status === "PUBLISHED" ? (
              <ActionButton action={setJobStatusAction} fields={{ jobId: job.id, status: "CLOSED" }} confirm="Close this job? It will stop accepting applications.">
                Close job
              </ActionButton>
            ) : null}
            {job._count.applications === 0 ? (
              <ActionButton action={deleteJobAction} fields={{ jobId: job.id }} variant="danger" confirm="Permanently delete this job? This cannot be undone." pendingLabel="Deleting…">
                Delete
              </ActionButton>
            ) : null}
          </>
        }
      />

      {created ? (
        <Alert tone="success" className="mb-4">
          Job {job.status === "PUBLISHED" ? "published" : "saved as a draft"}.
        </Alert>
      ) : null}
      {removed ? (
        <Alert tone="error" className="mb-4">
          A moderator removed this listing{job.moderationReason ? `: ${job.moderationReason}` : "."} It is hidden from candidates. Contact support if you believe this is a mistake.
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Status" value={<StatusBadge status={job.status} />} hint={job.publishedAt ? `Published ${formatDate(job.publishedAt)}` : "Not published yet"} />
        <StatCard label="Views" value={job.viewCount} />
        <StatCard label="Applicants" value={job._count.applications} hint={`Apply rate ${percent(job._count.applications, job.viewCount)}`} />
        <StatCard label="Hired" value={applicants.counts.HIRED ?? 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card title="Pipeline" actions={<Link href={`/recruiter/applicants?jobId=${job.id}`} className="text-sm">Open applicant list →</Link>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PIPELINE_STATUSES.map((status) => (
              <Link
                key={status}
                href={`/recruiter/applicants?jobId=${job.id}&status=${status}`}
                className="rounded-lg border border-slate-200 p-3 no-underline hover:border-brand-300 hover:bg-brand-50"
              >
                <p className="text-xs text-slate-500">{label(status)}</p>
                <p className="text-xl font-semibold text-slate-900 tabular-nums">{applicants.counts[status] ?? 0}</p>
              </Link>
            ))}
          </div>
          {applicants.counts.WITHDRAWN ? <p className="mt-3 text-xs text-slate-500">{applicants.counts.WITHDRAWN} withdrawn</p> : null}
        </Card>
        <Card title="Details">
          <DescriptionList
            items={[
              { term: "Experience", value: label(job.experienceLevel) },
              { term: "Salary", value: formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency) },
              { term: "Deadline", value: job.applicationDeadline ? formatDate(job.applicationDeadline) : "None" },
              { term: "Last updated", value: formatDate(job.updatedAt) },
            ]}
          />
          {job.skills.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          ) : null}
          {job._count.applications > 0 ? <p className="mt-4 text-xs text-slate-500">Jobs with applications cannot be deleted; close them instead.</p> : null}
        </Card>
      </div>
    </>
  );
}
