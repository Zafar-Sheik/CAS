import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { asRole, can, ROLES_REQUIRING_2FA, type Permission, type Role } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
};

/** Reads the session once per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Always hit the database so revoked or blocked sessions stop working immediately.
  const session = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  if (!session?.user) return null;
  const u = session.user as typeof session.user & {
    role?: string | null;
    twoFactorEnabled?: boolean | null;
    banned?: boolean | null;
  };
  if (u.banned) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: asRole(u.role),
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
  };
});

/** For pages: redirect to sign-in when there is no session. */
export async function requireUser(options?: { allowWithout2FA?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (
    !options?.allowWithout2FA &&
    process.env.ENFORCE_2FA !== "false" &&
    ROLES_REQUIRING_2FA.includes(user.role) &&
    !user.twoFactorEnabled
  ) {
    redirect("/settings/security?setup=2fa");
  }
  return user;
}

/** For pages that need a permission. */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard?denied=1");
  return user;
}

export class AuthError extends Error {}

/** For server actions: throws instead of redirecting. */
export async function assertPermission(permission?: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Your session has ended. Please sign in again.");
  if (
    process.env.ENFORCE_2FA !== "false" &&
    ROLES_REQUIRING_2FA.includes(user.role) &&
    !user.twoFactorEnabled
  ) {
    throw new AuthError("Turn on two-factor authentication before making changes.");
  }
  if (permission && !can(user.role, permission)) {
    throw new AuthError("You don't have permission to do that.");
  }
  return user;
}
