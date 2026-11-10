import type { PoolConfig } from "mariadb";

/**
 * Connection settings for TiDB (MySQL wire protocol), shared by the app and the seed script.
 * TiDB Cloud requires TLS, which is switched on automatically for *.tidbcloud.com hosts.
 */
export function poolConfigFromEnv(): PoolConfig {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is not set.");
  const url = new URL(raw);
  const isTidbCloud = url.hostname.endsWith("tidbcloud.com");
  const ssl = process.env.DATABASE_SSL === "true" || (isTidbCloud && process.env.DATABASE_SSL !== "false");

  return {
    host: url.hostname,
    port: Number(url.port || 4000),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    // The driver's default is 1 second, which a TLS handshake to a far-away region can exceed.
    connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 15000),
    acquireTimeout: Number(process.env.DATABASE_ACQUIRE_TIMEOUT_MS ?? 20000),
    ssl: ssl ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    allowPublicKeyRetrieval: !ssl,
  };
}
