import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "./button";

/**
 * GET-based filter form: works without JavaScript and keeps filters in the
 * URL, so results are shareable and the back button behaves as expected.
 */
export function FilterBar({ action, children, resetHref }: { action: string; children: ReactNode; resetHref: string }) {
  return (
    <form action={action} method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4" role="search">
      {children}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary", "md")}>
          Apply
        </button>
        <Link href={resetHref} className={buttonClass("ghost", "md")}>
          Reset
        </Link>
      </div>
    </form>
  );
}

const control = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function FilterInput({ label, name, defaultValue, placeholder, type = "search", className = "w-full sm:w-56" }: { label: string; name: string; defaultValue?: string | number; placeholder?: string; type?: string; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input type={type} name={name} defaultValue={defaultValue} placeholder={placeholder} className={control} />
    </label>
  );
}

export function FilterSelect({
  label,
  name,
  defaultValue,
  options,
  allLabel = "All",
  className = "w-full sm:w-44",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  allLabel?: string | null;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className={control}>
        {allLabel !== null ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
