import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client for TiDB (MySQL wire protocol) via the MariaDB driver adapter.
 * TiDB Cloud requires TLS — set DATABASE_SSL="true" (the default when the host
 * is a *.tidbcloud.com endpoint).
 */
function createClient() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const isTidbCloud = url.hostname.endsWith("tidbcloud.com");
  const ssl =
    process.env.DATABASE_SSL === "true" || (isTidbCloud && process.env.DATABASE_SSL !== "false");

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 4000),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    ssl: ssl ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    // TiDB/MySQL 8 auth over TLS
    allowPublicKeyRetrieval: !ssl,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
