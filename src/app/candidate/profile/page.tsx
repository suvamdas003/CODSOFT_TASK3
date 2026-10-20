import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card, PageHeader } from "@/components/ui/display";
import { CandidateProfileForm } from "@/features/candidates/components/profile-form";
import { getCandidateProfile } from "@/features/candidates/service";
import { requirePageUser } from "@/server/auth/session";
import type { SearchParams } from "@/lib/utils";

export const metadata: Metadata = { title: "My profile" };

export default async function CandidateProfilePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(["CANDIDATE"], "/candidate/profile");
  const profile = await getCandidateProfile(user);
  const { welcome } = await searchParams;

  return (
    <>
      <PageHeader title="My profile" description="Recruiters see this profile when you apply to their jobs. It is never shown publicly." />
      {welcome ? (
        <Alert tone="success" className="mb-4">
          Welcome to CareerHub! Tell recruiters a bit about yourself, then upload a resume.
        </Alert>
      ) : null}
      <Card>
        <CandidateProfileForm profile={profile} />
      </Card>
    </>
  );
}
