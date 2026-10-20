/** Joins class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Only allows same-site relative paths as post-login redirect targets, which
 * prevents open redirects such as `?next=https://evil.example` or `//evil`.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001F]/.test(value)) return fallback;
  return value;
}

/** Lower-cased, de-duplicated skills stored alongside the originals for case-insensitive filtering. */
export function skillKeysOf(skills: string[]): string[] {
  return [...new Set(skills.map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

export const PAGE_SIZE = 10;

/** Parses a 1-based page number from a query value. */
export function parsePage(value: unknown): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

/** Reads a single query-string value. */
export function param(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

/** Narrows a query value to one of the allowed enum members. */
export function enumParam<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const v = param(value);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Builds a query string from params, dropping empty values. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
