import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 deliberately does not read .env files (its config loader runs with
 * `dotenv: false`), and Next.js keeps our secrets in `.env.local` rather than
 * `.env`. Without this, `prisma migrate` / `studio` / `db seed` would not see
 * DATABASE_URL at all.
 *
 * Wrapped in try/catch so the file being absent is not fatal — in that case we
 * fall back to whatever is already in the real environment.
 */
try {
  process.loadEnvFile(path.join(import.meta.dirname, ".env.local"));
} catch {
  // No .env.local on disk; rely on real environment variables instead.
}

/**
 * Migrations, studio and seed run against the DIRECT (unpooled) connection.
 * Neon's pooled endpoint is PgBouncer in transaction mode, which does not
 * support the session-level advisory locks `prisma migrate` depends on.
 * The running app still uses the pooled DATABASE_URL via src/lib/db.ts.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "Neither DIRECT_URL nor DATABASE_URL is set. Add them to .env.local (see .env.example).",
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  migrations: {
    // Prisma 7 replaces the old `prisma.seed` key in package.json with this.
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: migrationUrl,
  },
});
