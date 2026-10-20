import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, DescriptionList, PageHeader, StatusBadge } from "@/components/ui/display";
import { deleteNoteAction, interviewStatusAction } from "@/features/applications/actions";
import { InterviewForm, NoteForm, StatusForm } from "@/features/applications/components/recruiter-forms";
import { StatusTimeline } from "@/features/applications/components/status-timeline";
import { getApplicationForRecruiter } from "@/features/applications/service";
import { AppError } from "@/lib/errors";
import { formatBytes, formatDate, formatDateTime, formatRelative, label } from "@/lib/format";
import { idField, isHttpUrl } from "@/lib/validation";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Applicant" };

function ExternalLink({ href }: { href: string | null | undefined }) {
  if (!href || !isHttpUrl(href)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all">
      {href.replace(/^https?:\/\//, "")}
    </a>
  );
}

export default async function RecruiterApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(["RECRUITER"], `/recruiter/applications/${id}`);
  if (!idField.safeParse(id).success) notFound();
  // Applications for other recruiters' jobs are reported as not found.
  const app = await getApplicationForRecruiter(user, id).catch((error) => {
    if (error instanceof AppError) notFound();
    throw error;
  });
  const profile = app.candidate.candidateProfile;
  const locked = app.status === "WITHDRAWN";
  const canInterview = !["HIRED", "REJECTED", "WITHDRAWN"].includes(app.status);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <Link href={`/recruiter/applicants?jobId=${app.job.id}`}>← Applicants for {app.job.title}</Link>
      </nav>
      <PageHeader title={app.candidate.name} description={profile?.headline ?? `Applied for ${app.job.title}`} actions={<StatusBadge status={app.status} />} />
      {locked ? (
        <Alert tone="warning" className="mb-4">
          The candidate withdrew this application. Their resume is no longer available to you.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Candidate profile">
            <DescriptionList
              items={[
                { term: "Email", value: <a href={`mailto:${app.candidate.email}`}>{app.candidate.email}</a> },
                { term: "Phone", value: profile?.phone },
                { term: "Location", value: profile?.location },
                { term: "Experience", value: profile?.experienceYears != null ? `${profile.experienceYears} years` : null },
                { term: "Preferred type", value: label(profile?.desiredEmploymentType) },
                { term: "Preferred workplace", value: label(profile?.desiredWorkplaceType) },
                { term: "LinkedIn", value: <ExternalLink href={profile?.linkedinUrl} /> },
                { term: "Portfolio", value: <ExternalLink href={profile?.portfolioUrl} /> },
              ]}
            />
            {profile?.skills.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            ) : null}
            {profile?.summary ? <p className="prose-text mt-4 border-t border-slate-100 pt-4">{profile.summary}</p> : null}
          </Card>

          <Card title="Application">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
              {app.resume && !locked ? (
                <>
                  <div className="text-sm">
                    <p className="font-medium">{app.resume.originalName}</p>
                    <p className="text-xs text-slate-500">{formatBytes(app.resume.sizeBytes)}</p>
                  </div>
                  <a href={`/api/resumes/${app.resume.id}`} className={buttonClass("secondary", "sm")}>
                    Download resume
                  </a>
                </>
              ) : (
                <p className="text-sm text-slate-600">No resume available.</p>
              )}
            </div>
            <p className="mb-2 text-xs text-slate-500">Applied {formatDate(app.createdAt)}</p>
            {app.coverLetter ? <p className="prose-text">{app.coverLetter}</p> : <p className="text-sm text-slate-600">No cover letter provided.</p>}
          </Card>

          <Card title="Interviews" bodyClassName="p-0">
            {app.interviews.length ? (
              <ul className="divide-y divide-slate-100">
                {app.interviews.map((interview) => (
                  <li key={interview.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatDateTime(interview.startsAt)}</p>
                      <p className="text-xs text-slate-500">
                        {label(interview.mode)} · {interview.durationMinutes} min{interview.location ? ` · ${interview.location}` : ""}
                      </p>
                      {interview.internalNotes ? <p className="mt-1 text-sm text-slate-700">Internal: {interview.internalNotes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={interview.status} />
                      {interview.status === "SCHEDULED" ? (
                        <>
                          <ActionButton action={interviewStatusAction} fields={{ interviewId: interview.id, status: "COMPLETED" }}>
                            Mark completed
                          </ActionButton>
                          <ActionButton action={interviewStatusAction} fields={{ interviewId: interview.id, status: "CANCELLED" }} variant="ghost" confirm="Cancel this interview? The candidate will be notified.">
                            Cancel
                          </ActionButton>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pt-5 text-sm text-slate-600">No interviews yet.</p>
            )}
            {canInterview ? (
              <div className="border-t border-slate-100 p-5">
                <InterviewForm applicationId={app.id} />
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Pipeline stage">{locked ? <p className="text-sm text-slate-600">Withdrawn applications cannot be moved.</p> : <StatusForm applicationId={app.id} status={app.status} />}</Card>
          <Card title="Internal notes">
            <NoteForm applicationId={app.id} />
            {app.notes.length ? (
              <ul className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                {app.notes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-amber-50 p-3">
                    <p className="text-sm whitespace-pre-line text-slate-800">{note.body}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">
                        {note.author.name} · {formatRelative(note.createdAt)}
                      </p>
                      {note.author.id === user.id ? (
                        <ActionButton action={deleteNoteAction} fields={{ noteId: note.id }} variant="ghost" confirm="Delete this note?">
                          Delete
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          <Card title="History">
            <StatusTimeline events={app.events} />
          </Card>
        </div>
      </div>
    </>
  );
}
