import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/session";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** An error whose message is safe to show the user. */
export class UserError extends Error {}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Runs an action body and turns known errors into friendly results; never leaks internals. */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return fail(err.issues[0]?.message ?? "Please check the form.", fieldErrors);
    }
    if (err instanceof AuthError || err instanceof UserError) return fail(err.message);
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return fail("That code or number is already in use.");
    if (code === "P2025") return fail("That record no longer exists.");
    console.error("[action]", err);
    return fail("Something went wrong. Please try again.");
  }
}
