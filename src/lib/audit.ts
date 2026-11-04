import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

export async function audit(
  tx: Tx,
  entry: { userId: string; action: string; entity: string; entityId?: string | null; summary: string },
) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    ip = null;
  }
  await tx.auditLog.create({
    data: { ...entry, entityId: entry.entityId ?? null, summary: entry.summary.slice(0, 500), ipAddress: ip },
  });
}
