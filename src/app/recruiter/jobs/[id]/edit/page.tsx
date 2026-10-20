import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/display";
import { JobForm } from "@/features/jobs/components/job-form";
import { getOwnedJob } from "@/features/jobs/service";
import { AppError } from "@/lib/errors";
import { idField } from "@/lib/validation";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(["RECRUITER"], `/recruiter/jobs/${id}/edit`);
  if (!idField.safeParse(id).success) notFound();
  // Jobs owned by someone else are reported as not found.
  const job = await getOwnedJob(user, id).catch((error) => {
    if (error instanceof AppError) notFound();
    throw error;
  });

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <Link href={`/recruiter/jobs/${job.id}`}>← Back to job</Link>
      </nav>
      <PageHeader title="Edit job" description={job.title} />
      <Card>
        <JobForm job={job} />
      </Card>
    </>
  );
}
