"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { CheckboxField, SelectField, TextArea, TextField } from "@/components/ui/fields";
import { updateCandidateProfileAction } from "@/features/candidates/actions";
import { EMPLOYMENT_TYPES, optionsFor, WORKPLACE_TYPES } from "@/lib/format";

export type ProfileValues = {
  headline: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  skills: string[];
  experienceYears: number | null;
  desiredEmploymentType: string | null;
  desiredWorkplaceType: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  openToWork: boolean;
};

export function CandidateProfileForm({ profile }: { profile: ProfileValues }) {
  return (
    <ActionForm action={updateCandidateProfileAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Headline" name="headline" defaultValue={profile.headline ?? ""} maxLength={160} placeholder="e.g. Senior Frontend Engineer" className="sm:col-span-2" />
        <TextField label="Location" name="location" defaultValue={profile.location ?? ""} maxLength={120} placeholder="City, Country" />
        <TextField label="Phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} maxLength={40} hint="Shared only with recruiters of jobs you apply to." />
        <TextField label="Years of experience" name="experienceYears" type="number" min={0} max={70} defaultValue={profile.experienceYears ?? ""} />
        <SelectField label="Preferred employment type" name="desiredEmploymentType" defaultValue={profile.desiredEmploymentType ?? ""} options={optionsFor(EMPLOYMENT_TYPES)} placeholder="No preference" />
        <SelectField label="Preferred workplace" name="desiredWorkplaceType" defaultValue={profile.desiredWorkplaceType ?? ""} options={optionsFor(WORKPLACE_TYPES)} placeholder="No preference" />
        <TextField label="Skills" name="skills" defaultValue={profile.skills.join(", ")} hint="Comma-separated, e.g. React, TypeScript, SQL" className="sm:col-span-2" />
        <TextField label="LinkedIn URL" name="linkedinUrl" type="url" defaultValue={profile.linkedinUrl ?? ""} placeholder="https://linkedin.com/in/…" />
        <TextField label="Portfolio URL" name="portfolioUrl" type="url" defaultValue={profile.portfolioUrl ?? ""} placeholder="https://…" />
        <TextArea label="Summary" name="summary" rows={6} defaultValue={profile.summary ?? ""} maxLength={5000} className="sm:col-span-2" />
      </div>
      <CheckboxField label="Open to work" name="openToWork" defaultChecked={profile.openToWork} hint="Signals to recruiters that you are actively looking." />
      <SubmitButton>Save profile</SubmitButton>
    </ActionForm>
  );
}
