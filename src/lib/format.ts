import type {
  ApplicationStatus,
  EmploymentType,
  ExperienceLevel,
  InterviewMode,
  InterviewStatus,
  JobStatus,
  ReportReason,
  ReportStatus,
  Role,
  WorkplaceType,
} from "@/generated/prisma/enums";

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"] as const satisfies readonly EmploymentType[];
export const WORKPLACE_TYPES = ["ONSITE", "HYBRID", "REMOTE"] as const satisfies readonly WorkplaceType[];
export const EXPERIENCE_LEVELS = ["ENTRY", "MID", "SENIOR", "LEAD", "EXECUTIVE"] as const satisfies readonly ExperienceLevel[];
export const JOB_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const satisfies readonly JobStatus[];
export const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const satisfies readonly ApplicationStatus[];
/** Statuses a recruiter can move an application to. WITHDRAWN is candidate-only. */
export const PIPELINE_STATUSES = ["APPLIED", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED", "REJECTED"] as const satisfies readonly ApplicationStatus[];
export const INTERVIEW_MODES = ["VIDEO", "PHONE", "ONSITE"] as const satisfies readonly InterviewMode[];
export const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const satisfies readonly InterviewStatus[];
export const REPORT_REASONS = ["SPAM", "FRAUD", "MISLEADING", "DISCRIMINATORY", "OFFENSIVE", "OTHER"] as const satisfies readonly ReportReason[];
export const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const satisfies readonly ReportStatus[];
export const ROLES = ["CANDIDATE", "RECRUITER", "ADMIN"] as const satisfies readonly Role[];

const LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
  ENTRY: "Entry level",
  MID: "Mid level",
  SENIOR: "Senior",
  LEAD: "Lead",
  EXECUTIVE: "Executive",
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  REJECTED: "Rejected",
  HIRED: "Hired",
  WITHDRAWN: "Withdrawn",
  VIDEO: "Video call",
  PHONE: "Phone",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  SPAM: "Spam",
  FRAUD: "Fraud or scam",
  MISLEADING: "Misleading",
  DISCRIMINATORY: "Discriminatory",
  OFFENSIVE: "Offensive",
  OTHER: "Other",
  OPEN: "Open",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
  CANDIDATE: "Candidate",
  RECRUITER: "Recruiter",
  ADMIN: "Administrator",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REMOVED: "Removed",
};

export function label(value: string | null | undefined): string {
  if (!value) return "";
  return LABELS[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

export function optionsFor(values: readonly string[]): { value: string; label: string }[] {
  return values.map((value) => ({ value, label: label(value) }));
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function formatDate(date: Date | string | null | undefined): string {
  return date ? dateFormatter.format(new Date(date)) : "—";
}

/** Times are displayed in UTC so server and client render identically. */
export function formatDateTime(date: Date | string | null | undefined): string {
  return date ? `${dateTimeFormatter.format(new Date(date))} UTC` : "—";
}

export function formatRelative(date: Date | string, now = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(date);
}

export function formatSalary(min: number | null, max: number | null, currency: string): string | null {
  if (min === null && max === null) return null;
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency} ${n.toLocaleString("en-US")}`;
    }
  };
  if (min !== null && max !== null) return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  return min !== null ? `From ${fmt(min)}` : `Up to ${fmt(max!)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}
