import { beforeAll, describe, expect, it } from "vitest";
import { createJob, deleteJob, getJobForViewer, getOwnedJob, listRecruiterJobs, recordJobView, reportJob, searchJobs, setJobStatus, toggleSavedJob, updateJob } from "@/features/jobs/service";
import { applyToJob } from "@/features/applications/service";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createCandidate, createPublishedJob, createRecruiter, jobInput, resetDatabase } from "../support/fixtures";

beforeAll(resetDatabase);

const search = (filters: Partial<Parameters<typeof searchJobs>[0]> = {}) => searchJobs({ page: 1, ...filters }, null);

describe("job CRUD and ownership", () => {
  it("creates drafts and published jobs, and lets only the owner edit them", async () => {
    const owner = await createRecruiter();
    const other = await createRecruiter("Other Co");
    const candidate = await createCandidate();

    const draft = await createJob(owner, jobInput({ title: "Draft Role" }), false);
    expect(draft.status).toBe("DRAFT");
    expect(draft.publishedAt).toBeNull();

    await updateJob(owner, draft.id, jobInput({ title: "Draft Role v2", skills: ["Go"] }));
    expect((await getOwnedJob(owner, draft.id)).title).toBe("Draft Role v2");

    await expect(updateJob(other, draft.id, jobInput())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setJobStatus(other, draft.id, "PUBLISHED")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteJob(other, draft.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createJob(candidate, jobInput(), true)).rejects.toBeInstanceOf(ForbiddenError);

    const published = await setJobStatus(owner, draft.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();

    const list = await listRecruiterJobs(owner, { page: 1 });
    expect(list.items.map((j) => j.id)).toContain(draft.id);
    expect((await listRecruiterJobs(other, { page: 1 })).total).toBe(0);
  });

  it("closes jobs, and deletes only jobs without applications", async () => {
    const owner = await createRecruiter();
    const candidate = await createCandidate();
    const empty = await createPublishedJob(owner, { title: "Empty" });
    await deleteJob(owner, empty.id);
    expect(await prisma.job.count({ where: { id: empty.id } })).toBe(0);

    const job = await createPublishedJob(owner, { title: "Busy" });
    await applyToJob(candidate, { jobId: job.id, resumeId: null, coverLetter: null });
    await expect(deleteJob(owner, job.id)).rejects.toBeInstanceOf(ConflictError);
    const closed = await setJobStatus(owner, job.id, "CLOSED");
    expect(closed.closedAt).not.toBeNull();
    await expect(setJobStatus(owner, job.id, "DRAFT")).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to publish with a past deadline", async () => {
    const owner = await createRecruiter();
    await expect(createJob(owner, jobInput({ applicationDeadline: new Date(Date.now() - 86_400_000) }), true)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("public search and visibility", () => {
  it("shows only published, active, open jobs from active recruiters", async () => {
    const owner = await createRecruiter("Visible Inc");
    const marker = `vis${Date.now()}`;
    const live = await createPublishedJob(owner, { title: `Live ${marker}` });
    const draft = await createJob(owner, jobInput({ title: `Draft ${marker}` }), false);
    const closed = await createPublishedJob(owner, { title: `Closed ${marker}` });
    await setJobStatus(owner, closed.id, "CLOSED");
    const expired = await createPublishedJob(owner, { title: `Expired ${marker}` });
    await prisma.job.update({ where: { id: expired.id }, data: { applicationDeadline: new Date(Date.now() - 1000) } });

    const result = await search({ q: marker });
    expect(result.items.map((j) => j.id)).toEqual([live.id]);

    // Anonymous visitors cannot open non-public jobs; the owner can preview.
    expect(await getJobForViewer(draft.id, null)).toBeNull();
    expect((await getJobForViewer(draft.id, owner))?.isPublic).toBe(false);
    expect(await getJobForViewer(draft.id, await createRecruiter())).toBeNull();
  });

  it("filters by keyword (title, company, case-insensitive skill), location, type and salary; sorts and paginates", async () => {
    const owner = await createRecruiter("Filterable Ltd");
    const tag = `flt${Date.now()}`;
    await createPublishedJob(owner, { title: `Frontend ${tag}`, skills: ["React", "TypeScript"], location: "Lisbon, Portugal", workplaceType: "HYBRID", salaryMin: 40000, salaryMax: 60000 });
    await createPublishedJob(owner, { title: `Backend ${tag}`, skills: ["Rust"], location: "Remote", workplaceType: "REMOTE", employmentType: "CONTRACT", salaryMin: 90000, salaryMax: 120000 });

    expect((await search({ q: tag })).total).toBe(2);
    expect((await search({ q: tag, workplaceType: "REMOTE" })).items[0].title).toBe(`Backend ${tag}`);
    expect((await search({ q: tag, employmentType: "CONTRACT" })).total).toBe(1);
    expect((await search({ q: tag, location: "lisbon" })).total).toBe(1);
    expect((await search({ q: tag, minSalary: 100000 })).items.map((j) => j.title)).toEqual([`Backend ${tag}`]);
    expect((await search({ q: "Filterable" })).total).toBeGreaterThanOrEqual(2);

    const bySkill = await search({ q: "typescript", company: "Filterable" });
    expect(bySkill.items.map((j) => j.title)).toContain(`Frontend ${tag}`);

    const sorted = await search({ q: tag, sort: "salary_desc" });
    expect(sorted.items.map((j) => j.title)).toEqual([`Backend ${tag}`, `Frontend ${tag}`]);

    // Pagination: page size is 10.
    for (let i = 0; i < 11; i++) await createPublishedJob(owner, { title: `Bulk ${tag} ${i}` });
    const page1 = await search({ q: `Bulk ${tag}` });
    const page2 = await search({ q: `Bulk ${tag}`, page: 2 });
    expect([page1.items.length, page2.items.length, page1.total]).toEqual([10, 1, 11]);
  });

  it("hides jobs whose recruiter is suspended and never exposes recruiter contact data", async () => {
    const owner = await createRecruiter();
    const tag = `susp${Date.now()}`;
    const job = await createPublishedJob(owner, { title: tag });
    const view = await getJobForViewer(job.id, null);
    expect(JSON.stringify(view)).not.toContain(owner.email);
    expect(view?.job).not.toHaveProperty("postedById");

    await prisma.user.update({ where: { id: owner.id }, data: { status: "SUSPENDED" } });
    expect((await search({ q: tag })).total).toBe(0);
  });

  it("counts views of public jobs but not the owner's own views", async () => {
    const owner = await createRecruiter();
    const job = await createPublishedJob(owner);
    await recordJobView(job.id, null);
    await recordJobView(job.id, owner);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).viewCount).toBe(1);
  });
});

describe("saved jobs and reports", () => {
  it("toggles bookmarks for candidates only", async () => {
    const owner = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(owner);
    expect(await toggleSavedJob(candidate, job.id)).toBe(true);
    expect((await searchJobs({ page: 1, q: job.title }, candidate)).items.find((j) => j.id === job.id)?.isSaved).toBe(true);
    expect(await toggleSavedJob(candidate, job.id)).toBe(false);
    await expect(toggleSavedJob(owner, job.id)).rejects.toBeInstanceOf(ForbiddenError);
    const draft = await createJob(owner, jobInput(), false);
    await expect(toggleSavedJob(candidate, draft.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("accepts one report per user and not from the owner", async () => {
    const owner = await createRecruiter();
    const candidate = await createCandidate();
    const job = await createPublishedJob(owner);
    await reportJob(candidate, job.id, "FRAUD", "Looks fake");
    await expect(reportJob(candidate, job.id, "SPAM", null)).rejects.toBeInstanceOf(ConflictError);
    await expect(reportJob(owner, job.id, "SPAM", null)).rejects.toBeInstanceOf(ValidationError);
  });
});
