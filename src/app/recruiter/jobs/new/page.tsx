import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/display";
import { EMPTY_JOB, JobForm } from "@/features/jobs/components/job-form";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  await requirePageUser(["RECRUITER"], "/recruiter/jobs/new");
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <Link href="/recruiter/jobs">← Job postings</Link>
      </nav>
      <PageHeader title="Post a job" description="Publish immediately or save a draft to finish later." />
      <Card>
        <JobForm job={EMPTY_JOB} />
      </Card>
    </>
  );
}
