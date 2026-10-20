import type { Metadata } from "next";
import { ActionButton } from "@/components/ui/action-form";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/display";
import { deleteResumeAction, setDefaultResumeAction } from "@/features/candidates/actions";
import { ReplaceResumeForm, UploadResumeForm } from "@/features/candidates/components/resume-forms";
import { listResumes } from "@/features/candidates/service";
import { config } from "@/lib/env";
import { formatBytes, formatDate } from "@/lib/format";
import { requirePageUser } from "@/server/auth/session";
import { getPlatformSettings } from "@/server/settings";

export const metadata: Metadata = { title: "My resumes" };

export default async function ResumesPage() {
  const user = await requirePageUser(["CANDIDATE"], "/candidate/resumes");
  const [resumes, settings] = await Promise.all([listResumes(user), getPlatformSettings()]);
  const atLimit = resumes.length >= settings.maxResumesPerCandidate;

  return (
    <>
      <PageHeader title="Resumes" description={`Keep up to ${settings.maxResumesPerCandidate} resumes. Your default resume is pre-selected when you apply.`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card title={`Your resumes (${resumes.length}/${settings.maxResumesPerCandidate})`} bodyClassName="p-0">
          {resumes.length ? (
            <ul className="divide-y divide-slate-100">
              {resumes.map((resume) => (
                <li key={resume.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {resume.originalName}
                      {resume.isDefault ? <Badge tone="blue">Default</Badge> : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {resume.mimeType === "application/pdf" ? "PDF" : "Word"} · {formatBytes(resume.sizeBytes)} · updated {formatDate(resume.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/api/resumes/${resume.id}`} className={buttonClass("secondary", "sm")}>
                      Download
                    </a>
                    {!resume.isDefault ? (
                      <ActionButton action={setDefaultResumeAction} fields={{ resumeId: resume.id }} variant="ghost">
                        Make default
                      </ActionButton>
                    ) : null}
                    <ReplaceResumeForm resumeId={resume.id} />
                    <ActionButton
                      action={deleteResumeAction}
                      fields={{ resumeId: resume.id }}
                      variant="danger"
                      confirm={`Delete "${resume.originalName}"? Recruiters will no longer be able to download it from your applications.`}
                      pendingLabel="Deleting…"
                    >
                      Delete
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState title="No resumes uploaded" description="Upload a PDF or Word resume to attach it to your applications." />
            </div>
          )}
        </Card>
        <Card title="Upload a resume">
          {atLimit ? <p className="mb-3 text-sm text-amber-800">You have reached the limit. Delete or replace a resume to upload another.</p> : null}
          <UploadResumeForm maxMb={Math.round(config.resumeMaxBytes / (1024 * 1024))} disabled={atLimit} />
        </Card>
      </div>
    </>
  );
}
