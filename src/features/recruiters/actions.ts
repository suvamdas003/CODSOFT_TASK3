"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/action";
import { formToObject, parseInput } from "@/lib/validation";
import { requireActor } from "@/server/auth/session";
import { companySchema, recruiterProfileSchema } from "./schemas";
import { updateCompany, updateRecruiterProfile } from "./service";

export async function updateCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    await updateCompany(actor, parseInput(companySchema, formToObject(formData)));
    revalidatePath("/", "layout");
    return "Company profile saved.";
  });
}

export async function updateRecruiterProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["RECRUITER"]);
    await updateRecruiterProfile(actor, parseInput(recruiterProfileSchema, formToObject(formData)));
    revalidatePath("/recruiter", "layout");
    return "Recruiter profile saved.";
  });
}
