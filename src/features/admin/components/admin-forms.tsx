"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { CheckboxField, TextArea, TextField } from "@/components/ui/fields";
import { moderateJobAction, resolveReportAction, setUserStatusAction, updateSettingsAction } from "@/features/admin/actions";

export function SuspendUserForm({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Suspend
      </Button>
    );
  }
  return (
    <ActionForm action={setUserStatusAction} className="w-64 space-y-2" confirm={`Suspend ${name}? They will be signed out immediately.`}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value="SUSPENDED" />
      <TextField label="Reason" name="reason" maxLength={300} placeholder="Recorded in the audit log" />
      <div className="flex gap-2">
        <SubmitButton variant="danger" size="sm">
          Confirm suspension
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

export function RemoveJobForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Remove
      </Button>
    );
  }
  return (
    <ActionForm action={moderateJobAction} className="w-72 space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="decision" value="REMOVE" />
      <TextArea label="Reason (sent to the recruiter)" name="reason" rows={2} required maxLength={500} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" size="sm">
          Remove listing
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

export function ResolveReportForm({ reportId, jobRemoved }: { reportId: string; jobRemoved: boolean }) {
  return (
    <ActionForm action={resolveReportAction} className="space-y-2">
      <input type="hidden" name="reportId" value={reportId} />
      <TextField label="Resolution note" name="note" maxLength={500} placeholder="Optional" />
      {!jobRemoved ? <CheckboxField label="Also remove the listing" name="removeJob" /> : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="resolution" value="RESOLVED" size="sm" variant="primary">
          Resolve
        </SubmitButton>
        <SubmitButton name="resolution" value="DISMISSED" size="sm" variant="secondary">
          Dismiss
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SettingsForm({
  settings,
}: {
  settings: { allowCandidateRegistration: boolean; allowRecruiterRegistration: boolean; maxResumesPerCandidate: number; announcement: string | null };
}) {
  return (
    <ActionForm action={updateSettingsAction} className="space-y-5">
      <CheckboxField label="Allow candidate registration" name="allowCandidateRegistration" defaultChecked={settings.allowCandidateRegistration} />
      <CheckboxField label="Allow recruiter registration" name="allowRecruiterRegistration" defaultChecked={settings.allowRecruiterRegistration} />
      <TextField label="Maximum resumes per candidate" name="maxResumesPerCandidate" type="number" min={1} max={20} defaultValue={settings.maxResumesPerCandidate} required className="max-w-xs" />
      <TextField label="Site-wide announcement" name="announcement" defaultValue={settings.announcement ?? ""} maxLength={300} hint="Shown as a banner on every page. Leave empty to hide." />
      <SubmitButton>Save settings</SubmitButton>
    </ActionForm>
  );
}
