import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/auth-forms";
import { getCurrentUser, homePathFor } from "@/server/auth/session";
import { param, safeRedirectPath, type SearchParams } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const next = param(sp.next);
  const user = await getCurrentUser();
  if (user) redirect(safeRedirectPath(next, homePathFor(user.role)));

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">Sign in to manage your applications or hiring pipeline.</p>
        <LoginForm next={next ? safeRedirectPath(next) : undefined} />
      </div>
    </div>
  );
}
