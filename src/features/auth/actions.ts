"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/action";
import { formToObject, parseInput } from "@/lib/validation";
import { safeRedirectPath } from "@/lib/utils";
import { endSession, hashToken, homePathFor, requireActor, SESSION_COOKIE, startSession, type Actor } from "@/server/auth/session";
import { getClientIp } from "@/server/request";
import { accountSchema, changePasswordSchema, loginSchema, registerSchema } from "./schemas";
import { authenticate, changePassword, registerUser, updateAccountName } from "./service";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let user: Actor | undefined;
  const state = await runAction(async () => {
    const input = parseInput(loginSchema, formToObject(formData));
    user = await authenticate(input.email, input.password, await getClientIp());
    await startSession(user.id);
  });
  if (!user) return state;
  redirect(safeRedirectPath(formData.get("next"), homePathFor(user.role)));
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let user: Actor | undefined;
  const state = await runAction(async () => {
    const input = parseInput(registerSchema, formToObject(formData));
    user = await registerUser(input, await getClientIp());
    await startSession(user.id);
  });
  if (!user) return state;
  redirect(user.role === "RECRUITER" ? "/recruiter/company?welcome=1" : "/candidate/profile?welcome=1");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor();
    const input = parseInput(changePasswordSchema, formToObject(formData));
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    await changePassword(actor, input.currentPassword, input.newPassword, token ? hashToken(token) : undefined);
    return "Password updated. Other devices have been signed out.";
  });
}

export async function updateAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor();
    const input = parseInput(accountSchema, formToObject(formData));
    await updateAccountName(actor, input.name);
    revalidatePath("/", "layout");
    return "Account details saved.";
  });
}
