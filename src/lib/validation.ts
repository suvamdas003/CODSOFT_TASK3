import { z } from "zod";
import { ValidationError } from "@/lib/errors";

/** Converts FormData to a plain object of strings, skipping files and framework fields. */
export function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION") || typeof value !== "string") continue;
    result[key] = value;
  }
  return result;
}

/** Parses input with a Zod schema, throwing a ValidationError with per-field messages. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  throw new ValidationError("Please correct the highlighted fields.", fieldErrors);
}

// ─── Reusable field schemas ─────────────────────────────────────────────────

/** Required trimmed text. Control characters other than newlines/tabs are rejected. */
export const requiredText = (label: string, max: number, min = 1) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`)
    .refine((v) => !hasControlChars(v), `${label} contains invalid characters.`);

/** Optional trimmed text; empty strings become null. */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .refine((v) => !hasControlChars(v), `${label} contains invalid characters.`)
    .optional()
    .transform((v) => (v ? v : null));

/** Optional http(s) URL; empty strings become null. `javascript:` and friends are rejected. */
export const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(300, `${label} must be at most 300 characters.`)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isHttpUrl(v), `${label} must be a valid http(s) URL.`);

export const optionalInt = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), `${label} must be a whole number between ${min} and ${max}.`);

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

/** Comma- or newline-separated list of short tags (skills), de-duplicated case-insensitively. */
export const tagList = (label: string, maxItems = 25, maxLength = 40) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const seen = new Set<string>();
      const tags: string[] = [];
      for (const raw of (v ?? "").split(/[,\n]/)) {
        const tag = raw.trim().replace(/\s+/g, " ");
        if (!tag || seen.has(tag.toLowerCase())) continue;
        seen.add(tag.toLowerCase());
        tags.push(tag);
      }
      return tags;
    })
    .refine((tags) => tags.length <= maxItems, `${label}: at most ${maxItems} items.`)
    .refine((tags) => tags.every((t) => t.length <= maxLength && !hasControlChars(t)), `${label}: each item must be at most ${maxLength} characters.`);

export const emailField = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

export const passwordField = z
  .string({ error: "Password is required." })
  .min(10, "Password must be at least 10 characters.")
  .max(128, "Password must be at most 128 characters.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Password must contain letters and numbers.");

export const idField = z.string().trim().min(1).max(40).regex(/^[a-z0-9]+$/i, "Invalid identifier.");

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function hasControlChars(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}
