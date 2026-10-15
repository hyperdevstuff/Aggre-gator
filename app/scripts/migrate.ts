// Applies pending drizzle migrations to DATABASE_URL. Exists because the
// production image installs --production and drizzle-kit (which powers
// `bun run db:migrate`) is a devDependency — deploys run this instead:
//   docker compose -f docker-compose.prod.yml run --rm api bun scripts/migrate.ts
// Locally `bun run db:migrate` still does the same job.
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log(`migrations applied to ${new URL(url).host}`);
} catch (error) {
  console.error(
    `migration failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
} finally {
  await pool.end();
}
