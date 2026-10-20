import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser, homePathFor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Access denied" };

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-sm font-semibold text-red-600">403</p>
      <h1 className="mt-2 text-2xl font-semibold">Access denied</h1>
      <p className="mt-2 text-sm text-slate-600">Your account does not have permission to view that page.</p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href={user ? homePathFor(user.role) : "/login"}>{user ? "Go to my dashboard" : "Sign in"}</LinkButton>
      </div>
    </div>
  );
}
