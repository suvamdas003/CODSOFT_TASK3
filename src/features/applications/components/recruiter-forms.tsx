"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { SelectField, TextArea, TextField } from "@/components/ui/fields";
import { addNoteAction, changeStatusAction, scheduleInterviewAction } from "@/features/applications/actions";
import { INTERVIEW_MODES, label, optionsFor, PIPELINE_STATUSES } from "@/lib/format";

export function StatusForm({ applicationId, status }: { applicationId: string; status: string }) {
  return (
    <ActionForm action={changeStatusAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <SelectField
        label="Move to stage"
        name="status"
        defaultValue={PIPELINE_STATUSES.includes(status as never) ? status : "APPLIED"}
        options={PIPELINE_STATUSES.map((s) => ({ value: s, label: label(s) }))}
      />
      <SubmitButton size="sm" pendingLabel="Updating…">
        Update status
      </SubmitButton>
    </ActionForm>
  );
}

export function NoteForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm action={addNoteAction} className="space-y-3" resetOnSuccess>
      <input type="hidden" name="applicationId" value={applicationId} />
      <TextArea label="Add an internal note" name="body" rows={3} required maxLength={4000} hint="Visible to you only. Never shown to the candidate." />
      <SubmitButton size="sm" pendingLabel="Adding…">
        Add note
      </SubmitButton>
    </ActionForm>
  );
}

export function InterviewForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm action={scheduleInterviewAction} className="space-y-3" resetOnSuccess>
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Date & time (UTC)" name="startsAt" type="datetime-local" required />
        <TextField label="Duration (minutes)" name="durationMinutes" type="number" min={5} max={480} defaultValue={45} required />
        <SelectField label="Type" name="mode" options={optionsFor(INTERVIEW_MODES)} defaultValue="VIDEO" required />
        <TextField label="Link, phone or address" name="location" maxLength={300} hint="Shared with the candidate." />
      </div>
      <TextArea label="Internal notes" name="internalNotes" rows={2} maxLength={2000} hint="Interviewers, focus areas… Not shown to the candidate." />
      <SubmitButton size="sm" pendingLabel="Scheduling…">
        Schedule interview
      </SubmitButton>
    </ActionForm>
  );
}
