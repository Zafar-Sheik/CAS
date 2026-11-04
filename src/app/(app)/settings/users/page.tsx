import type { Metadata } from "next";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { UsersPanel } from "@/components/settings/users-panel";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requirePermission("users:manage");
  const users = await db.user.findMany({
    orderBy: [{ banned: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, banned: true, twoFactorEnabled: true, createdAt: true, sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  return (
    <UsersPanel
      meId={me.id}
      meRole={me.role}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role ?? "viewer",
        banned: Boolean(u.banned),
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        lastActive: u.sessions[0]?.updatedAt.toISOString() ?? null,
      }))}
    />
  );
}
