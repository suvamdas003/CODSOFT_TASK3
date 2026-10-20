"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea } from "@/components/ui/fields";
import { applyAction } from "@/features/applications/actions";
import { reportJobAction } from "@/features/jobs/actions";
import { formatBytes, label, REPORT_REASONS } from "@/lib/format";

type ResumeOption = { id: string; originalName: string; sizeBytes: number; isDefault: boolean };

export function ApplyForm({ jobId, resumes }: { jobId: string; resumes: ResumeOption[] }) {
  const defaultResume = resumes.find((r) => r.isDefault) ?? resumes[0];
  return (
    <ActionForm action={applyAction} className="space-y-4" showSuccess={false}>
      <input type="hidden" name="jobId" value={jobId} />
      {resumes.length ? (
        <SelectField
          label="Resume"
          name="resumeId"
          defaultValue={defaultResume?.id}
          options={resumes.map((r) => ({ value: r.id, label: `${r.originalName} (${formatBytes(r.sizeBytes)})${r.isDefault ? " — default" : ""}` }))}
          placeholder="Apply without a resume"
        />
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You have no resumes yet. <a href="/candidate/resumes">Upload one</a> for a stronger application, or apply without it.
        </p>
      )}
      <TextArea label="Cover letter" name="coverLetter" rows={6} maxLength={5000} hint="Optional. Up to 5,000 characters." />
      <SubmitButton className="w-full" pendingLabel="Submitting…">
        Submit application
      </SubmitButton>
    </ActionForm>
  );
}

export function ReportJobForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Report this listing
      </Button>
    );
  }
  return (
    <ActionForm action={reportJobAction} className="space-y-3" resetOnSuccess>
      <input type="hidden" name="jobId" value={jobId} />
      <SelectField label="Reason" name="reason" required options={REPORT_REASONS.map((r) => ({ value: r, label: label(r) }))} placeholder="Choose a reason" />
      <TextArea label="Details" name="details" rows={3} maxLength={1000} hint="Optional. What is wrong with this listing?" />
      <div className="flex gap-2">
        <SubmitButton variant="danger" size="sm" pendingLabel="Sending…">
          Send report
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
