import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Optional here so `npm install` / `prisma generate` work without a database.
    // Migrate and seed still need DATABASE_URL (from .env or the environment).
    url: process.env.DATABASE_URL,
  },
});
