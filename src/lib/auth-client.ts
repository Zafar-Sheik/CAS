"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient, adminClient } from "better-auth/client/plugins";
import { ac, authRoles } from "@/lib/auth-roles";

export const authClient = createAuthClient({
  plugins: [
    // The sign-in form routes to /login/two-factor when a code is required.
    twoFactorClient(),
    adminClient({ ac, roles: authRoles }),
  ],
});
