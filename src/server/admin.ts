"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { assertPermission, getCurrentUser, AuthError } from "@/lib/session";
import { audit } from "@/lib/audit";
import { settingsSchema, newUserSchema, passwordSchema, type SettingsInput } from "@/lib/validation";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { run, UserError, type ActionResult } from "./action";
import { z } from "zod";

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  return run(async () => {
    const user = await assertPermission("settings:manage");
    const data = settingsSchema.parse(input);
    await db.companySettings.update({ where: { id: 1 }, data });
    await audit(db, { userId: user.id, action: "settings.update", entity: "settings", summary: "Updated company settings" });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved" };
  });
}

/** Sensitive admin actions need a recent sign-in. */
async function assertFreshSession() {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  if (!session) throw new UserError("Your session has ended.");
  const age = Date.now() - new Date(session.session.createdAt).getTime();
  if (age > 1000 * 60 * 60 * 12) {
    throw new UserError("For safety, sign out and sign in again before managing users.");
  }
}

export async function createUser(input: z.input<typeof newUserSchema>): Promise<ActionResult> {
  return run(async () => {
    const actor = await assertPermission("users:manage");
    await assertFreshSession();
    const data = newUserSchema.parse(input);
    if (data.role === "owner" && actor.role !== "owner") throw new UserError("Only the owner can add another owner.");
    const exists = await db.user.findUnique({ where: { email: data.email } });
    if (exists) throw new UserError("Someone already uses that email.");
    const userId = randomUUID();
    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: userId, name: data.name, email: data.email, emailVerified: true, role: data.role },
      });
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: await hashPassword(data.password),
        },
      });
      await audit(tx, {
        userId: actor.id,
        action: "user.create",
        entity: "user",
        entityId: userId,
        summary: `Added ${data.email} as ${ROLE_LABELS[data.role]}`,
      });
    });
    revalidatePath("/settings/users");
    return { ok: true, message: "User added. Share the temporary password privately." };
  });
}

async function guardTarget(actorId: string, actorRole: Role, targetId: string) {
  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) throw new UserError("User not found.");
  if (target.id === actorId) throw new UserError("You can't change your own access here.");
  if (target.role === "owner" && actorRole !== "owner") throw new UserError("Only the owner can change an owner.");
  return target;
}

export async function setUserRole(userId: string, role: Role): Promise<ActionResult> {
  return run(async () => {
    const actor = await assertPermission("users:manage");
    await assertFreshSession();
    const r = z.enum(ROLES).parse(role);
    if (r === "owner" && actor.role !== "owner") throw new UserError("Only the owner can make someone an owner.");
    const target = await guardTarget(actor.id, actor.role, userId);
    await db.user.update({ where: { id: userId }, data: { role: r } });
    await db.session.deleteMany({ where: { userId } }); // new permissions apply on next sign-in
    await audit(db, { userId: actor.id, action: "user.role", entity: "user", entityId: userId, summary: `${target.email} is now ${ROLE_LABELS[r]}` });
    revalidatePath("/settings/users");
    return { ok: true, message: "Role updated" };
  });
}

export async function setUserBlocked(userId: string, blocked: boolean): Promise<ActionResult> {
  return run(async () => {
    const actor = await assertPermission("users:manage");
    await assertFreshSession();
    const target = await guardTarget(actor.id, actor.role, userId);
    await db.user.update({
      where: { id: userId },
      data: { banned: blocked, banReason: blocked ? "Access removed by administrator" : null },
    });
    if (blocked) await db.session.deleteMany({ where: { userId } });
    await audit(db, { userId: actor.id, action: blocked ? "user.block" : "user.unblock", entity: "user", entityId: userId, summary: `${target.email} ${blocked ? "blocked" : "unblocked"}` });
    revalidatePath("/settings/users");
    return { ok: true, message: blocked ? "Access removed" : "Access restored" };
  });
}

export async function resetUserPassword(userId: string, password: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await assertPermission("users:manage");
    await assertFreshSession();
    const pw = passwordSchema.parse(password);
    const target = await guardTarget(actor.id, actor.role, userId);
    await db.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: await hashPassword(pw) },
    });
    await db.session.deleteMany({ where: { userId } });
    await audit(db, { userId: actor.id, action: "user.reset_password", entity: "user", entityId: userId, summary: `Reset password for ${target.email}` });
    return { ok: true, message: "Password reset and sessions signed out" };
  });
}

export async function resetUserTwoFactor(userId: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await assertPermission("users:manage");
    await assertFreshSession();
    const target = await guardTarget(actor.id, actor.role, userId);
    await db.$transaction([
      db.twoFactor.deleteMany({ where: { userId } }),
      db.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
      db.session.deleteMany({ where: { userId } }),
    ]);
    await audit(db, { userId: actor.id, action: "user.reset_2fa", entity: "user", entityId: userId, summary: `Reset two-factor for ${target.email}` });
    revalidatePath("/settings/users");
    return { ok: true, message: "Two-factor reset. They'll set it up at next sign-in." };
  });
}

export async function revokeMySession(sessionId: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await getCurrentUser();
    if (!actor) throw new AuthError("Your session has ended.");
    const s = await db.session.findUnique({ where: { id: z.string().parse(sessionId) } });
    if (!s || s.userId !== actor.id) throw new UserError("Session not found.");
    await db.session.delete({ where: { id: s.id } });
    await audit(db, { userId: actor.id, action: "session.revoke", entity: "session", entityId: s.id, summary: "Signed out a device" });
    revalidatePath("/settings/security");
    return { ok: true, message: "Device signed out" };
  });
}
