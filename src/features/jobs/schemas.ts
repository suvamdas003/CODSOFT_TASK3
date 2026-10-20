import { z } from "zod";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, REPORT_REASONS, WORKPLACE_TYPES } from "@/lib/format";
import { optionalInt, optionalText, requiredText, tagList } from "@/lib/validation";

const MAX_SALARY = 100_000_000;

export const jobInputSchema = z
  .object({
    title: requiredText("Title", 160, 3),
    location: requiredText("Location", 120, 2),
    workplaceType: z.enum(WORKPLACE_TYPES, { error: "Choose a workplace type." }),
    employmentType: z.enum(EMPLOYMENT_TYPES, { error: "Choose an employment type." }),
    experienceLevel: z.enum(EXPERIENCE_LEVELS, { error: "Choose an experience level." }),
    description: requiredText("Description", 10_000, 20),
    requirements: requiredText("Requirements", 10_000, 10),
    responsibilities: optionalText("Responsibilities", 10_000),
    benefits: optionalText("Benefits", 5_000),
    salaryMin: optionalInt("Minimum salary", 0, MAX_SALARY),
    salaryMax: optionalInt("Maximum salary", 0, MAX_SALARY),
    salaryCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v) => v || "USD")
      .pipe(z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as USD.")),
    skills: tagList("Skills", 20),
    applicationDeadline: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? new Date(`${v}T23:59:59.000Z`) : null))
      .refine((v) => v === null || !Number.isNaN(v.getTime()), "Enter a valid date."),
  })
  .refine((v) => v.salaryMin === null || v.salaryMax === null || v.salaryMin <= v.salaryMax, {
    message: "Minimum salary cannot exceed maximum salary.",
    path: ["salaryMax"],
  });

export type JobInput = z.output<typeof jobInputSchema>;

export const JOB_SORTS = ["newest", "oldest", "salary_desc", "salary_asc"] as const;
export type JobSort = (typeof JOB_SORTS)[number];

export type JobSearchFilters = {
  q?: string;
  location?: string;
  company?: string;
  employmentType?: (typeof EMPLOYMENT_TYPES)[number];
  workplaceType?: (typeof WORKPLACE_TYPES)[number];
  experienceLevel?: (typeof EXPERIENCE_LEVELS)[number];
  minSalary?: number;
  sort?: JobSort;
  page: number;
};

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { error: "Choose a reason." }),
  details: optionalText("Details", 1000),
});
