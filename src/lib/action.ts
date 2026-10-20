import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/errors";

/** State returned by every server action that is bound with `useActionState`. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every completed submission so the UI can react to repeated identical results. */
  at?: number;
} | null;

/**
 * Runs a server action body and converts domain errors into an ActionState.
 * Next.js control-flow errors (redirect, notFound) are re-thrown untouched.
 * Unexpected errors are logged server-side and reported generically.
 */
export async function runAction(body: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await body();
    return { ok: true, message: message ?? "Saved.", at: Date.now() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors, at: Date.now() };
    }
    console.error("[action] unexpected error", error);
    return { ok: false, message: "Something went wrong. Please try again.", at: Date.now() };
  }
}
