import { z } from "zod";
import { checkbox, idField, optionalText, requiredText } from "@/lib/validation";

export const userStatusSchema = z.object({
  userId: idField,
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: optionalText("Reason", 300),
});

export const companyVerifySchema = z.object({
  companyId: idField,
  verified: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const moderateJobSchema = z
  .object({
    jobId: idField,
    decision: z.enum(["REMOVE", "RESTORE"]),
    reason: optionalText("Reason", 500),
  })
  .refine((v) => v.decision === "RESTORE" || v.reason, { message: "Give a reason for removing the listing.", path: ["reason"] });

export const resolveReportSchema = z.object({
  reportId: idField,
  resolution: z.enum(["RESOLVED", "DISMISSED"]),
  note: optionalText("Resolution note", 500),
  removeJob: checkbox,
});

export const settingsSchema = z.object({
  allowCandidateRegistration: checkbox,
  allowRecruiterRegistration: checkbox,
  maxResumesPerCandidate: z.coerce.number({ error: "Enter a number." }).int().min(1, "At least 1.").max(20, "At most 20."),
  announcement: optionalText("Announcement", 300),
});

export const announcementText = requiredText("Announcement", 300);
