"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { formToObject, idField, parseInput } from "@/lib/validation";
import { requireActor } from "@/server/auth/session";
import { jobInputSchema, reportSchema } from "./schemas";
import { createJob, deleteJob, reportJob, setJobStatus, toggleSavedJob, updateJob } from "./service";

const jobIdSchema = z.object({ jobId: idField });

export async function createJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let createdId: string | undefined;
  const state = await runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const input = parseInput(jobInputSchema, formToObject(formData));
    const job = await createJob(actor, input, formData.get("intent") === "publish");
    createdId = job.id;
  });
  if (!createdId) return state;
  revalidatePath("/recruiter", "layout");
  revalidatePath("/jobs");
  redirect(`/recruiter/jobs/${createdId}?created=1`);
}

export async function updateJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const { jobId } = parseInput(jobIdSchema, formToObject(formData));
    const input = parseInput(jobInputSchema, formToObject(formData));
    await updateJob(actor, jobId, input);
    revalidatePath("/recruiter", "layout");
    revalidatePath(`/jobs/${jobId}`);
    return "Job updated.";
  });
}

const statusSchema = z.object({ jobId: idField, status: z.enum(["PUBLISHED", "CLOSED"]) });

export async function setJobStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const { jobId, status } = parseInput(statusSchema, formToObject(formData));
    await setJobStatus(actor, jobId, status);
    revalidatePath("/recruiter", "layout");
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    return status === "PUBLISHED" ? "Job published." : "Job closed. It no longer accepts applications.";
  });
}

export async function deleteJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let deleted = false;
  const state = await runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const { jobId } = parseInput(jobIdSchema, formToObject(formData));
    await deleteJob(actor, jobId);
    deleted = true;
  });
  if (!deleted) return state;
  revalidatePath("/recruiter", "layout");
  revalidatePath("/jobs");
  redirect("/recruiter/jobs?deleted=1");
}

export async function toggleSaveJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    const { jobId } = parseInput(jobIdSchema, formToObject(formData));
    const saved = await toggleSavedJob(actor, jobId);
    revalidatePath("/jobs", "layout");
    revalidatePath("/candidate/saved");
    return saved ? "Job saved." : "Removed from saved jobs.";
  });
}

export async function reportJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor();
    const { jobId } = parseInput(jobIdSchema, formToObject(formData));
    const input = parseInput(reportSchema, formToObject(formData));
    await reportJob(actor, jobId, input.reason, input.details);
    revalidatePath(`/jobs/${jobId}`);
    return "Thank you. Our moderators will review this listing.";
  });
}
