"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { formToObject, idField, parseInput } from "@/lib/validation";
import { requireActor } from "@/server/auth/session";
import { applySchema, interviewSchema, interviewStatusSchema, noteSchema, statusChangeSchema } from "./schemas";
import {
  addApplicationNote,
  applyToJob,
  deleteApplicationNote,
  scheduleInterview,
  updateApplicationStatus,
  updateInterviewStatus,
  withdrawApplication,
} from "./service";

export async function applyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let applicationId: string | undefined;
  const state = await runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    const input = parseInput(applySchema, formToObject(formData));
    applicationId = (await applyToJob(actor, input)).id;
  });
  if (!applicationId) return state;
  revalidatePath("/candidate", "layout");
  redirect(`/candidate/applications/${applicationId}?applied=1`);
}

const applicationIdSchema = z.object({ applicationId: idField });

export async function withdrawAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    const { applicationId } = parseInput(applicationIdSchema, formToObject(formData));
    await withdrawApplication(actor, applicationId);
    revalidatePath("/candidate", "layout");
    return "Application withdrawn.";
  });
}

export async function changeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const { applicationId, status } = parseInput(statusChangeSchema, formToObject(formData));
    await updateApplicationStatus(actor, applicationId, status);
    revalidatePath("/recruiter", "layout");
    return "Status updated. The candidate has been notified.";
  });
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const { applicationId, body } = parseInput(noteSchema, formToObject(formData));
    await addApplicationNote(actor, applicationId, body);
    revalidatePath(`/recruiter/applications/${applicationId}`);
    return "Note added.";
  });
}

export async function deleteNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const { noteId } = parseInput(z.object({ noteId: idField }), formToObject(formData));
    const applicationId = await deleteApplicationNote(actor, noteId);
    revalidatePath(`/recruiter/applications/${applicationId}`);
    return "Note deleted.";
  });
}

export async function scheduleInterviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const input = parseInput(interviewSchema, formToObject(formData));
    await scheduleInterview(actor, input);
    revalidatePath("/recruiter", "layout");
    return "Interview scheduled. The candidate has been notified.";
  });
}

export async function interviewStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    const { interviewId, status } = parseInput(interviewStatusSchema, formToObject(formData));
    await updateInterviewStatus(actor, interviewId, status);
    revalidatePath("/recruiter", "layout");
    return status === "CANCELLED" ? "Interview cancelled." : "Interview marked as completed.";
  });
}
