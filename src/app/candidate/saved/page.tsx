import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui/display";
import { JobCard } from "@/features/jobs/components/job-card";
import { SaveJobButton } from "@/features/jobs/components/save-job-button";
import { listSavedJobs } from "@/features/jobs/service";
import { parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Saved jobs" };

export default async function SavedJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser(["CANDIDATE"], "/candidate/saved");
  const result = await listSavedJobs(user, parsePage((await searchParams).page));

  return (
    <>
      <PageHeader title="Saved jobs" description="Jobs you bookmarked to review or apply to later." />
      {result.items.length ? (
        <div className="space-y-3">
          {result.items.map(({ job }) => {
            const unavailable = job.status !== "PUBLISHED" || job.moderationStatus !== "ACTIVE";
            return (
              <JobCard
                key={job.id}
                job={job}
                action={
                  <div className="flex items-center gap-2">
                    {unavailable ? <Badge tone="gray">No longer open</Badge> : null}
                    <SaveJobButton jobId={job.id} saved />
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState title="No saved jobs" description="Use the Save button on any job to keep it here." action={<LinkButton href="/jobs">Browse jobs</LinkButton>} />
      )}
      <Pagination basePath="/candidate/saved" page={result.page} pageSize={result.pageSize} total={result.total} />
    </>
  );
}
