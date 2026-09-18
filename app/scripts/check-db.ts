// Fail fast with an actionable message when the configured Postgres is
// unreachable. Used by `bun run check:db` (root and app) before tests or
// migrations, so a missing database surfaces here instead of as a 5s hook
// timeout deep inside the test suite.
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local (dev) or .env.test.example to .env.test.local (tests) and fill it in.");
  process.exit(1);
}

const parsed = new URL(url);
const target = `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });

try {
  await pool.query("SELECT 1");
  console.log(`database ok: ${target}`);
} catch (error) {
  console.error(`database unreachable at ${target}: ${error instanceof Error ? error.message : error}`);
  console.error("start it with `bun run db:up` from the repo root (requires a running Docker daemon), then run migrations with `bun run db:migrate`.");
  process.exit(1);
} finally {
  await pool.end();
}
