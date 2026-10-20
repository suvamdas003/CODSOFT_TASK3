"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { formToObject, idField, parseInput } from "@/lib/validation";
import { requireActor } from "@/server/auth/session";
import { markNotificationsRead } from "@/server/notifications";

export async function markNotificationsReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireActor();
    const { notificationId } = parseInput(z.object({ notificationId: idField.optional() }), formToObject(formData));
    await markNotificationsRead(actor, notificationId);
    revalidatePath("/", "layout");
    return notificationId ? "Marked as read." : "All notifications marked as read.";
  });
}
