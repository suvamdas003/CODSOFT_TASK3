import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { RegisterForm } from "@/features/auth/components/auth-forms";
import { getCurrentUser, homePathFor } from "@/server/auth/session";
import { getPlatformSettings } from "@/server/settings";
import { param, type SearchParams } from "@/lib/utils";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));
  const sp = await searchParams;
  const settings = await getPlatformSettings();
  const open = settings.allowCandidateRegistration || settings.allowRecruiterRegistration;

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">Join CareerHub as a candidate or as a recruiter.</p>
        {open ? (
          <RegisterForm
            initialRole={param(sp.role) === "RECRUITER" ? "RECRUITER" : "CANDIDATE"}
            allowCandidate={settings.allowCandidateRegistration}
            allowRecruiter={settings.allowRecruiterRegistration}
          />
        ) : (
          <Alert tone="warning">Registration is temporarily closed. Please check back later.</Alert>
        )}
      </div>
    </div>
  );
}
