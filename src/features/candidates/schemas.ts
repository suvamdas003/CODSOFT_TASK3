import { z } from "zod";
import { EMPLOYMENT_TYPES, WORKPLACE_TYPES } from "@/lib/format";
import { checkbox, optionalInt, optionalText, optionalUrl, tagList } from "@/lib/validation";

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.enum(values).nullable());

export const candidateProfileSchema = z.object({
  headline: optionalText("Headline", 160),
  summary: optionalText("Summary", 5000),
  location: optionalText("Location", 120),
  phone: optionalText("Phone", 40).refine((v) => v === null || /^[+\d][\d\s().-]{4,39}$/.test(v), "Enter a valid phone number."),
  skills: tagList("Skills", 30),
  experienceYears: optionalInt("Years of experience", 0, 70),
  desiredEmploymentType: optionalEnum(EMPLOYMENT_TYPES),
  desiredWorkplaceType: optionalEnum(WORKPLACE_TYPES),
  linkedinUrl: optionalUrl("LinkedIn URL"),
  portfolioUrl: optionalUrl("Portfolio URL"),
  openToWork: checkbox,
});

export type CandidateProfileInput = z.output<typeof candidateProfileSchema>;
