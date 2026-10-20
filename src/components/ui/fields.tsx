"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFieldError } from "./action-form";

const control =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100";

type FieldShellProps = { label: string; name: string; hint?: ReactNode; className?: string; required?: boolean };

function FieldShell({ id, label, hint, error, className, required, children }: Omit<FieldShellProps, "name"> & { id: string; error?: string; children: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, name, hint, className, required, ...props }: FieldShellProps & Omit<ComponentProps<"input">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} required={required}>
      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(control, error ? "border-red-400" : "border-slate-300")}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({ label, name, hint, className, required, rows = 5, ...props }: FieldShellProps & Omit<ComponentProps<"textarea">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} required={required}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(control, error ? "border-red-400" : "border-slate-300")}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  hint,
  className,
  required,
  options,
  placeholder,
  ...props
}: FieldShellProps & Omit<ComponentProps<"select">, "name"> & { options: readonly { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} required={required}>
      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(control, error ? "border-red-400" : "border-slate-300")}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({ label, name, hint, className, ...props }: Omit<FieldShellProps, "required"> & Omit<ComponentProps<"input">, "name" | "type">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input id={id} type="checkbox" name={name} className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600" {...props} />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Shows a form-level field error that has no visible input (e.g. hidden ids). */
export function FieldErrorText({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? <p className="text-xs text-red-600">{error}</p> : null;
}
