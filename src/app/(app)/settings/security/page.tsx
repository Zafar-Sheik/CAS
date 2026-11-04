import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ROLES_REQUIRING_2FA } from "@/lib/roles";
import { SecurityPanel } from "@/components/settings/security-panel";
import { str } from "@/lib/params";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage(props: PageProps<"/settings/security">) {
  const user = await requireUser({ allowWithout2FA: true });
  const sp = await props.searchParams;
  const current = await auth.api.getSession({ headers: await headers() });
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, updatedAt: true },
  });
  return (
    <SecurityPanel
      user={{ name: user.name, email: user.email, twoFactorEnabled: user.twoFactorEnabled }}
      required={ROLES_REQUIRING_2FA.includes(user.role)}
      prompt={str(sp, "setup") === "2fa" && !user.twoFactorEnabled}
      currentSessionId={current?.session.id ?? ""}
      sessions={sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() }))}
    />
  );
}
