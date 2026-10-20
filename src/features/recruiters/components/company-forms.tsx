"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { SelectField, TextArea, TextField } from "@/components/ui/fields";
import { updateCompanyAction, updateRecruiterProfileAction } from "@/features/recruiters/actions";
import { COMPANY_SIZES } from "@/features/recruiters/schemas";

type Company = { name: string; website: string | null; industry: string | null; size: string | null; location: string | null; description: string | null };

export function CompanyForm({ company }: { company: Company }) {
  return (
    <ActionForm action={updateCompanyAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Company name" name="name" defaultValue={company.name} required maxLength={120} />
        <TextField label="Website" name="website" type="url" defaultValue={company.website ?? ""} placeholder="https://" maxLength={300} />
        <TextField label="Industry" name="industry" defaultValue={company.industry ?? ""} maxLength={80} />
        <SelectField label="Company size" name="size" defaultValue={company.size ?? ""} options={COMPANY_SIZES.map((s) => ({ value: s, label: `${s} employees` }))} placeholder="Not specified" />
        <TextField label="Headquarters" name="location" defaultValue={company.location ?? ""} maxLength={120} className="sm:col-span-2" />
        <TextArea label="About the company" name="description" defaultValue={company.description ?? ""} rows={6} maxLength={5000} className="sm:col-span-2" />
      </div>
      <SubmitButton>Save company</SubmitButton>
    </ActionForm>
  );
}

export function RecruiterProfileForm({ jobTitle, phone }: { jobTitle: string | null; phone: string | null }) {
  return (
    <ActionForm action={updateRecruiterProfileAction} className="space-y-4">
      <TextField label="Your job title" name="jobTitle" defaultValue={jobTitle ?? ""} maxLength={120} placeholder="e.g. Talent Acquisition Lead" />
      <TextField label="Phone" name="phone" type="tel" defaultValue={phone ?? ""} maxLength={40} hint="Internal only — not shown to candidates." />
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}
