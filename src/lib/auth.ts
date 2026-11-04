import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor, haveIBeenPwned } from "better-auth/plugins";
import { db } from "@/lib/db";
import { ac, authRoles } from "@/lib/auth-roles";

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  appName: "CAS ERP",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").filter(Boolean),
  database: prismaAdapter(db, { provider: "mysql" }),

  emailAndPassword: {
    enabled: true,
    // Accounts are created by an owner/admin inside the app — no public sign-up.
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 3, // 3 days
    updateAge: 60 * 60 * 4, // roll the session every 4 hours of activity
    freshAge: 60 * 15, // sensitive actions need a sign-in from the last 15 minutes
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: isProd,
    cookiePrefix: "cas",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProd },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
    },
  },

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await db.auditLog.create({
            data: {
              userId: session.userId,
              action: "auth.sign_in",
              entity: "session",
              entityId: session.id,
              summary: `Signed in${session.userAgent ? ` from ${session.userAgent.slice(0, 120)}` : ""}`,
              ipAddress: session.ipAddress ?? null,
            },
          });
        },
      },
    },
  },

  plugins: [
    twoFactor({
      issuer: "CAS ERP",
      backupCodeOptions: { amount: 10, length: 10 },
      trustDeviceMaxAge: 60 * 60 * 24 * 30,
    }),
    admin({ ac, roles: authRoles, defaultRole: "staff", adminRoles: ["owner", "admin"] }),
    // Rejects passwords found in known breaches (k-anonymity API, password never leaves the server in full).
    ...(process.env.DISABLE_PWNED_CHECK === "true" ? [] : [haveIBeenPwned()]),
    nextCookies(), // must stay last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
