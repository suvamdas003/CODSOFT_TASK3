import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge, Card, PageHeader } from "@/components/ui/display";
import { CompanyForm, RecruiterProfileForm } from "@/features/recruiters/components/company-forms";
import { getRecruiterContext } from "@/features/recruiters/service";
import type { SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyProfilePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(["RECRUITER"], "/recruiter/company");
  const profile = await getRecruiterContext(user);
  const { welcome } = await searchParams;

  return (
    <>
      <PageHeader
        title="Company profile"
        description={
          <>
            Shown publicly on your <Link href={`/companies/${profile.company.slug}`}>company page</Link> and job listings.
          </>
        }
        actions={profile.company.verified ? <Badge tone="green">✓ Verified company</Badge> : <Badge tone="amber">Verification pending</Badge>}
      />
      {welcome ? (
        <Alert tone="success" className="mb-4">
          Welcome to CareerHub! Complete your company profile, then post your first job.
        </Alert>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card title="Company">
          <CompanyForm company={profile.company} />
        </Card>
        <Card title="Your recruiter profile">
          <RecruiterProfileForm jobTitle={profile.jobTitle} phone={profile.phone} />
        </Card>
      </div>
    </>
  );
}
