import { z } from "zod";
import { INTERVIEW_MODES, PIPELINE_STATUSES } from "@/lib/format";
import { idField, optionalText, requiredText } from "@/lib/validation";

export const applySchema = z.object({
  jobId: idField,
  resumeId: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .pipe(idField.nullable()),
  coverLetter: optionalText("Cover letter", 5000),
});

export const statusChangeSchema = z.object({
  applicationId: idField,
  status: z.enum(PIPELINE_STATUSES, { error: "Choose a valid status." }),
});

export const noteSchema = z.object({
  applicationId: idField,
  body: requiredText("Note", 4000),
});

export const interviewSchema = z.object({
  applicationId: idField,
  /** `datetime-local` value, interpreted as UTC (the UI labels times as UTC). */
  startsAt: z
    .string({ error: "Choose a date and time." })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.")
    .transform((v) => new Date(`${v}:00.000Z`))
    .refine((d) => !Number.isNaN(d.getTime()), "Choose a valid date and time.")
    .refine((d) => d.getTime() > Date.now() - 60_000, "Interviews must be scheduled in the future."),
  durationMinutes: z.coerce.number({ error: "Enter a duration." }).int().min(5, "At least 5 minutes.").max(480, "At most 8 hours."),
  mode: z.enum(INTERVIEW_MODES, { error: "Choose an interview type." }),
  location: optionalText("Location or link", 300),
  internalNotes: optionalText("Internal notes", 2000),
});

export type InterviewInput = z.output<typeof interviewSchema>;

export const interviewStatusSchema = z.object({
  interviewId: idField,
  status: z.enum(["COMPLETED", "CANCELLED"]),
});
