"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/fields";
import { cn } from "@/lib/utils";
import { loginAction, registerAction } from "@/features/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4" showSuccess={false}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-slate-600">
        New to CareerHub? <Link href="/register">Create an account</Link>
      </p>
    </ActionForm>
  );
}

export function RegisterForm({
  initialRole,
  allowCandidate,
  allowRecruiter,
}: {
  initialRole: "CANDIDATE" | "RECRUITER";
  allowCandidate: boolean;
  allowRecruiter: boolean;
}) {
  const [role, setRole] = useState<"CANDIDATE" | "RECRUITER">(
    initialRole === "RECRUITER" ? (allowRecruiter ? "RECRUITER" : "CANDIDATE") : allowCandidate ? "CANDIDATE" : "RECRUITER",
  );
  const options = [
    { value: "CANDIDATE" as const, title: "I'm looking for a job", enabled: allowCandidate },
    { value: "RECRUITER" as const, title: "I'm hiring", enabled: allowRecruiter },
  ];

  return (
    <ActionForm action={registerAction} className="space-y-4" showSuccess={false}>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Account type</legend>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-center text-sm font-medium",
                role === option.value ? "border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-200" : "border-slate-300 text-slate-700",
                !option.enabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                disabled={!option.enabled}
                onChange={() => setRole(option.value)}
                className="sr-only"
              />
              {option.title}
            </label>
          ))}
        </div>
      </fieldset>
      <TextField label="Full name" name="name" autoComplete="name" required maxLength={120} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        hint="At least 10 characters, with letters and numbers."
      />
      {role === "RECRUITER" ? (
        <>
          <TextField label="Company name" name="companyName" required maxLength={120} autoComplete="organization" />
          <TextField label="Company website" name="companyWebsite" type="url" placeholder="https://example.com" maxLength={300} />
        </>
      ) : null}
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-slate-600">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </ActionForm>
  );
}
