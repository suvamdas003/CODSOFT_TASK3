import Link from "next/link";
import type { ReactNode } from "react";
import { label as labelFor } from "@/lib/format";
import { buildQuery, cn } from "@/lib/utils";

const BADGE_TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-800 ring-brand-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  purple: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  APPLIED: "blue",
  SHORTLISTED: "purple",
  INTERVIEW: "amber",
  OFFERED: "green",
  HIRED: "green",
  REJECTED: "red",
  WITHDRAWN: "gray",
  DRAFT: "gray",
  PUBLISHED: "green",
  CLOSED: "gray",
  REMOVED: "red",
  ACTIVE: "green",
  SUSPENDED: "red",
  OPEN: "amber",
  RESOLVED: "green",
  DISMISSED: "gray",
  SCHEDULED: "blue",
  COMPLETED: "green",
  CANCELLED: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{labelFor(status)}</Badge>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClassName }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("card", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
          <path d="M3 7h18M3 12h18M3 17h10" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Server-rendered pagination that preserves the current filters. */
export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  params = {},
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | number | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const href = (p: number) => `${basePath}${buildQuery({ ...params, page: p > 1 ? p : undefined })}`;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 no-underline hover:bg-slate-50";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <p>
        Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkCls} href={href(page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={cn(linkCls, "pointer-events-none opacity-50")} aria-disabled>
            Previous
          </span>
        )}
        <span>
          Page {Math.min(page, pages)} of {pages}
        </span>
        {page < pages ? (
          <Link className={linkCls} href={href(page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span className={cn(linkCls, "pointer-events-none opacity-50")} aria-disabled>
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

export function DescriptionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term}>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{item.term}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Horizontal bar used for simple, dependency-free charts. */
export function Bar({ value, max, label, tone = "bg-brand-500" }: { value: number; max: number; label: string; tone?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-slate-600">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${value}`}>
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value > 0 ? pct : 0}%` }} />
      </div>
      <span className="w-10 text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}
