"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FieldErrorText } from "@/components/ui/fields";
import { replaceResumeAction, uploadResumeAction } from "@/features/candidates/actions";
import { RESUME_ACCEPT } from "@/features/candidates/resume-file";

const fileInput =
  "block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-100";

export function UploadResumeForm({ maxMb, disabled }: { maxMb: number; disabled: boolean }) {
  return (
    <ActionForm action={uploadResumeAction} encType="multipart/form-data" className="space-y-3" resetOnSuccess>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Resume file</span>
        <input type="file" name="file" accept={RESUME_ACCEPT} required disabled={disabled} className={fileInput} />
      </label>
      <FieldErrorText name="file" />
      <p className="text-xs text-slate-500">PDF or Word (.docx), up to {maxMb} MB. Files are stored privately and shared only with recruiters of jobs you apply to.</p>
      <SubmitButton pendingLabel="Uploading…" className={disabled ? "pointer-events-none opacity-60" : undefined}>
        Upload resume
      </SubmitButton>
    </ActionForm>
  );
}

export function ReplaceResumeForm({ resumeId }: { resumeId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Replace
      </Button>
    );
  }
  return (
    <ActionForm action={replaceResumeAction} encType="multipart/form-data" className="mt-2 w-full space-y-2" resetOnSuccess>
      <input type="hidden" name="resumeId" value={resumeId} />
      <input type="file" name="file" accept={RESUME_ACCEPT} required className={fileInput} aria-label="Replacement file" />
      <FieldErrorText name="file" />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Uploading…">
          Upload replacement
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
