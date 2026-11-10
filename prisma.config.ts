import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma's migration engine connects on its own (not through the app's driver adapter),
 * so TLS has to be requested in the URL. TiDB Cloud refuses connections without it.
 */
function databaseUrl(raw: string | undefined) {
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(raw);
    const wantsTls =
      process.env.DATABASE_SSL === "true" ||
      (url.hostname.endsWith("tidbcloud.com") && process.env.DATABASE_SSL !== "false");
    if (wantsTls && !url.searchParams.has("sslaccept")) url.searchParams.set("sslaccept", "strict");
    return url.toString();
  } catch {
    return raw; // let Prisma report a malformed URL in its own words
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Optional here so `npm install` / `prisma generate` work without a database.
    // Migrate and seed still need DATABASE_URL (from .env or the environment).
    url: databaseUrl(process.env.DATABASE_URL),
  },
});
