import { config } from "dotenv";
// `override: true` is required: Bun auto-loads `.env.local` for scripts, so without
// it the dev DATABASE_URL would win over the test one.
config({ path: ".env.test.local", override: true });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
