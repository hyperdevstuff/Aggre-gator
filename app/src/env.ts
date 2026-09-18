/**
 * Fail-fast environment validation for the API.
 *
 * Imported first in `src/index.ts` (before the db/auth module graph), so a
 * missing `DATABASE_URL` surfaces here with a fix hint instead of deep in
 * `db/index.ts`. Throws — never silently defaults security-sensitive values.
 */
import "dotenv/config";

type NodeEnv = "development" | "test" | "production";

export type Env = {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string | undefined;
  BETTER_AUTH_URL: string;
  CLIENT_URL: string;
  GOOGLE_CLIENT_ID: string | undefined;
  GOOGLE_CLIENT_SECRET: string | undefined;
};

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

function validate(): Env {
  const problems: string[] = [];
  const hint = "Copy app/.env.example to app/.env.local (dev) or app/.env.test.example to app/.env.test.local (tests) and fill it in.";

  const rawNodeEnv = process.env.NODE_ENV || "development";
  const NODE_ENV: NodeEnv =
    rawNodeEnv === "production" || rawNodeEnv === "test" || rawNodeEnv === "development"
      ? rawNodeEnv
      : "development";
  if (!["production", "test", "development"].includes(rawNodeEnv)) {
    problems.push(`NODE_ENV=${JSON.stringify(rawNodeEnv)} is not one of production|test|development (defaulting to development).`);
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) problems.push(`DATABASE_URL is missing. ${hint}`);

  const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || undefined;
  if (!BETTER_AUTH_SECRET) {
    if (NODE_ENV === "test") {
      // Throwaway database; better-auth falls back to an ephemeral secret.
      console.warn("[env] BETTER_AUTH_SECRET is missing — using an ephemeral secret (test only).");
    } else {
      problems.push(`BETTER_AUTH_SECRET is missing (generate with: openssl rand -base64 32). ${hint}`);
    }
  }

  const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL;
  if (!BETTER_AUTH_URL) problems.push(`BETTER_AUTH_URL is missing. ${hint}`);

  const CLIENT_URL = process.env.CLIENT_URL;
  if (!CLIENT_URL) {
    problems.push(`CLIENT_URL is missing — it must exactly match the Vite origin (CORS + trustedOrigins). ${hint}`);
  }

  const rawPort = process.env.PORT;
  let PORT = 3001;
  if (rawPort !== undefined && rawPort !== "") {
    const parsed = Number(rawPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      problems.push(`PORT=${JSON.stringify(rawPort)} is not a valid TCP port.`);
    } else {
      PORT = parsed;
    }
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || undefined;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || undefined;
  if ((GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET) || (!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)) {
    problems.push("Google OAuth needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or neither).");
  }

  if (NODE_ENV === "production") {
    // Secure session cookies + CORS are only meaningful over https.
    if (BETTER_AUTH_URL && !isHttps(BETTER_AUTH_URL)) {
      problems.push(`BETTER_AUTH_URL must be https in production (got ${JSON.stringify(BETTER_AUTH_URL)}).`);
    }
    if (CLIENT_URL && !isHttps(CLIENT_URL)) {
      problems.push(`CLIENT_URL must be https in production (got ${JSON.stringify(CLIENT_URL)}).`);
    }
    if (BETTER_AUTH_SECRET && BETTER_AUTH_SECRET.length < 32) {
      problems.push("BETTER_AUTH_SECRET must be at least 32 characters in production.");
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }

  return {
    NODE_ENV,
    PORT,
    DATABASE_URL: DATABASE_URL!,
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: BETTER_AUTH_URL!,
    CLIENT_URL: CLIENT_URL!,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  };
}

export const env = validate();
