"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { formToObject, idField, parseInput } from "@/lib/validation";
import { requireActor } from "@/server/auth/session";
import { candidateProfileSchema } from "./schemas";
import { deleteResume, replaceResume, setDefaultResume, updateCandidateProfile, uploadResume, type UploadedFile } from "./service";

const resumeIdSchema = z.object({ resumeId: idField });

async function readUploadedFile(formData: FormData): Promise<UploadedFile> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ValidationError("Choose a file to upload.", { file: "Choose a file to upload." });
  }
  return { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
}

export async function updateCandidateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    const input = parseInput(candidateProfileSchema, formToObject(formData));
    await updateCandidateProfile(actor, input);
    revalidatePath("/candidate", "layout");
    return "Profile saved.";
  });
}

export async function uploadResumeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    await uploadResume(actor, await readUploadedFile(formData));
    revalidatePath("/candidate", "layout");
    return "Resume uploaded.";
  });
}

export async function replaceResumeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    const { resumeId } = parseInput(resumeIdSchema, formToObject(formData));
    await replaceResume(actor, resumeId, await readUploadedFile(formData));
    revalidatePath("/candidate", "layout");
    return "Resume replaced.";
  });
}

export async function setDefaultResumeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    const { resumeId } = parseInput(resumeIdSchema, formToObject(formData));
    await setDefaultResume(actor, resumeId);
    revalidatePath("/candidate", "layout");
    return "Default resume updated.";
  });
}

export async function deleteResumeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["CANDIDATE"]);
    const { resumeId } = parseInput(resumeIdSchema, formToObject(formData));
    await deleteResume(actor, resumeId);
    revalidatePath("/candidate", "layout");
    return "Resume deleted.";
  });
}
