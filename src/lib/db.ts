import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { poolConfigFromEnv } from "@/lib/db-config";

/** Prisma client for TiDB via the MariaDB driver adapter. Settings live in db-config.ts. */
function createClient() {
  return new PrismaClient({
    adapter: new PrismaMariaDb(poolConfigFromEnv()),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
