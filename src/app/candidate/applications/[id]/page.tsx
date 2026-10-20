import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Card, DescriptionList, PageHeader, StatusBadge } from "@/components/ui/display";
import { withdrawAction } from "@/features/applications/actions";
import { StatusTimeline } from "@/features/applications/components/status-timeline";
import { getCandidateApplication } from "@/features/applications/service";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateTime, label } from "@/lib/format";
import type { SearchParams } from "@/lib/utils";
import { idField } from "@/lib/validation";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Application" };

export default async function CandidateApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const user = await requirePageUser(["CANDIDATE"], `/candidate/applications/${id}`);
  if (!idField.safeParse(id).success) notFound();
  const app = await getCandidateApplication(user, id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const { applied } = await searchParams;
  const canWithdraw = !["HIRED", "REJECTED", "WITHDRAWN"].includes(app.status);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <Link href="/candidate/applications">← My applications</Link>
      </nav>
      <PageHeader
        title={app.job.title}
        description={
          <>
            {app.job.company.name} · {app.job.location} · applied {formatDate(app.createdAt)}
          </>
        }
        actions={<StatusBadge status={app.status} />}
      />
      {applied ? (
        <Alert tone="success" className="mb-4">
          Application submitted! The recruiter has been notified. You can follow its progress here.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Interviews" bodyClassName="p-0">
            {app.interviews.length ? (
              <ul className="divide-y divide-slate-100">
                {app.interviews.map((interview) => (
                  <li key={interview.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium">{formatDateTime(interview.startsAt)}</p>
                      <p className="text-xs text-slate-500">
                        {label(interview.mode)} · {interview.durationMinutes} minutes
                      </p>
                      {interview.location ? <p className="mt-1 text-sm break-all text-slate-700">{interview.location}</p> : null}
                    </div>
                    <StatusBadge status={interview.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-slate-600">No interviews scheduled yet.</p>
            )}
          </Card>
          <Card title="Your submission">
            <DescriptionList
              items={[
                { term: "Resume", value: app.resume ? <a href={`/api/resumes/${app.resume.id}`}>{app.resume.originalName}</a> : "No resume attached" },
                { term: "Job", value: <Link href={`/jobs/${app.job.id}`}>View job posting</Link> },
                { term: "Employment type", value: label(app.job.employmentType) },
                { term: "Workplace", value: label(app.job.workplaceType) },
              ]}
            />
            {app.coverLetter ? (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold">Cover letter</h3>
                <p className="prose-text">{app.coverLetter}</p>
              </div>
            ) : null}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Status history">
            <StatusTimeline events={app.events} />
          </Card>
          {canWithdraw ? (
            <Card title="Withdraw">
              <p className="mb-3 text-sm text-slate-600">No longer interested? Withdrawing cancels upcoming interviews and cannot be undone.</p>
              <ActionButton action={withdrawAction} fields={{ applicationId: app.id }} variant="danger" confirm="Withdraw this application? This cannot be undone.">
                Withdraw application
              </ActionButton>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
