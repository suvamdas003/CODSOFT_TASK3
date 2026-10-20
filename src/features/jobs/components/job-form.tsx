"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { SelectField, TextArea, TextField } from "@/components/ui/fields";
import { createJobAction, updateJobAction } from "@/features/jobs/actions";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, optionsFor, WORKPLACE_TYPES } from "@/lib/format";

export type JobFormValues = {
  id?: string;
  title: string;
  location: string;
  workplaceType: string;
  employmentType: string;
  experienceLevel: string;
  description: string;
  requirements: string;
  responsibilities: string | null;
  benefits: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  skills: string[];
  applicationDeadline: Date | null;
};

export const EMPTY_JOB: JobFormValues = {
  title: "",
  location: "",
  workplaceType: "ONSITE",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  description: "",
  requirements: "",
  responsibilities: null,
  benefits: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "USD",
  skills: [],
  applicationDeadline: null,
};

export function JobForm({ job }: { job: JobFormValues }) {
  const editing = Boolean(job.id);
  return (
    <ActionForm action={editing ? updateJobAction : createJobAction} className="space-y-6">
      {job.id ? <input type="hidden" name="jobId" value={job.id} /> : null}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold text-slate-900">Basics</legend>
        <TextField label="Job title" name="title" defaultValue={job.title} required maxLength={160} className="sm:col-span-2" />
        <TextField label="Location" name="location" defaultValue={job.location} required maxLength={120} placeholder="e.g. Berlin, Germany" />
        <SelectField label="Workplace" name="workplaceType" defaultValue={job.workplaceType} options={optionsFor(WORKPLACE_TYPES)} required />
        <SelectField label="Employment type" name="employmentType" defaultValue={job.employmentType} options={optionsFor(EMPLOYMENT_TYPES)} required />
        <SelectField label="Experience level" name="experienceLevel" defaultValue={job.experienceLevel} options={optionsFor(EXPERIENCE_LEVELS)} required />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-slate-900">Compensation &amp; timing</legend>
        <TextField label="Minimum salary (yearly)" name="salaryMin" type="number" min={0} defaultValue={job.salaryMin ?? ""} />
        <TextField label="Maximum salary (yearly)" name="salaryMax" type="number" min={0} defaultValue={job.salaryMax ?? ""} />
        <TextField label="Currency" name="salaryCurrency" defaultValue={job.salaryCurrency} maxLength={3} hint="ISO code, e.g. USD, EUR, INR" />
        <TextField
          label="Application deadline"
          name="applicationDeadline"
          type="date"
          defaultValue={job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().slice(0, 10) : ""}
          hint="Optional. The job stops accepting applications after this date (UTC)."
        />
        <TextField label="Skills" name="skills" defaultValue={job.skills.join(", ")} hint="Comma-separated" className="sm:col-span-2" />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold text-slate-900">Description</legend>
        <TextArea label="About the role" name="description" defaultValue={job.description} required rows={7} maxLength={10000} hint="At least 20 characters." />
        <TextArea label="Responsibilities" name="responsibilities" defaultValue={job.responsibilities ?? ""} rows={5} maxLength={10000} />
        <TextArea label="Requirements" name="requirements" defaultValue={job.requirements} required rows={5} maxLength={10000} />
        <TextArea label="Benefits" name="benefits" defaultValue={job.benefits ?? ""} rows={4} maxLength={5000} />
      </fieldset>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
        {editing ? (
          <SubmitButton>Save changes</SubmitButton>
        ) : (
          <>
            <SubmitButton name="intent" value="publish" pendingLabel="Publishing…">
              Publish job
            </SubmitButton>
            <SubmitButton name="intent" value="draft" variant="secondary">
              Save as draft
            </SubmitButton>
          </>
        )}
      </div>
    </ActionForm>
  );
}
