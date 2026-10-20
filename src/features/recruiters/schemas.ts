import { z } from "zod";
import { optionalText, optionalUrl, requiredText } from "@/lib/validation";

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;

export const companySchema = z.object({
  name: requiredText("Company name", 120, 2),
  website: optionalUrl("Website"),
  industry: optionalText("Industry", 80),
  size: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.enum(COMPANY_SIZES).nullable()),
  location: optionalText("Headquarters", 120),
  description: optionalText("Description", 5000),
});

export type CompanyInput = z.output<typeof companySchema>;

export const recruiterProfileSchema = z.object({
  jobTitle: optionalText("Job title", 120),
  phone: optionalText("Phone", 40).refine((v) => v === null || /^[+\d][\d\s().-]{4,39}$/.test(v), "Enter a valid phone number."),
});
