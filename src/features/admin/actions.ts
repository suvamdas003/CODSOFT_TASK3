"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/action";
import { formToObject, parseInput } from "@/lib/validation";
import { requireActor } from "@/server/auth/session";
import { getClientIp } from "@/server/request";
import { companyVerifySchema, moderateJobSchema, resolveReportSchema, settingsSchema, userStatusSchema } from "./schemas";
import { moderateJob, resolveReport, setCompanyVerified, setUserStatus, updateSettings } from "./service";

export async function setUserStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["ADMIN"]);
    const input = parseInput(userStatusSchema, formToObject(formData));
    await setUserStatus(actor, input.userId, input.status, input.reason, await getClientIp());
    revalidatePath("/admin", "layout");
    return input.status === "SUSPENDED" ? "User suspended and signed out." : "User reactivated.";
  });
}

export async function setCompanyVerifiedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["ADMIN"]);
    const input = parseInput(companyVerifySchema, formToObject(formData));
    await setCompanyVerified(actor, input.companyId, input.verified, await getClientIp());
    revalidatePath("/", "layout");
    return input.verified ? "Company verified." : "Verification removed.";
  });
}

export async function moderateJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["ADMIN"]);
    const input = parseInput(moderateJobSchema, formToObject(formData));
    await moderateJob(actor, input.jobId, input.decision, input.reason, await getClientIp());
    revalidatePath("/", "layout");
    return input.decision === "REMOVE" ? "Listing removed from the site." : "Listing restored.";
  });
}

export async function resolveReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["ADMIN"]);
    const input = parseInput(resolveReportSchema, formToObject(formData));
    await resolveReport(actor, input, await getClientIp());
    revalidatePath("/", "layout");
    return input.resolution === "DISMISSED" ? "Report dismissed." : input.removeJob ? "Report resolved and listing removed." : "Report resolved.";
  });
}

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor(["ADMIN"]);
    const input = parseInput(settingsSchema, formToObject(formData));
    await updateSettings(actor, input, await getClientIp());
    revalidatePath("/", "layout");
    return "Settings saved.";
  });
}
