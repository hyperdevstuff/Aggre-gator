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
  /**
   * Which transport `utils/mail.ts` speaks through.
   *
   * `none` is the default and is a genuine no-op: nothing is sent and no socket
   * is opened, which is what keeps the test suite off the network and what keeps
   * us from mailing from an unverified domain before `be-08` lands. `reloop`
   * requires `RELOOP_API_KEY` + `RELOOP_FROM` below.
   */
  MAIL_PROVIDER: "none" | "reloop";
  RELOOP_API_KEY: string | undefined;
  /** `hello@aggregator.com` or `Aggregator <hello@aggregator.com>`. */
  RELOOP_FROM: string | undefined;
  /**
   * Trust `x-forwarded-for` / `cf-connecting-ip` for per-client rate limiting.
   * Only enable when the API genuinely sits behind a proxy/CDN that overwrites
   * those headers — otherwise a caller can spoof an IP and walk around the
   * per-client limits.
   */
  TRUST_PROXY: boolean;
  /**
   * Directory containing the built SPA (client/dist). When set, the API serves
   * the SPA itself and the public pages fall back to the app shell instead of
   * JSON for browsers — the single-process deployment, no nginx tier
   * (docs/DEPLOY.md). Unset keeps the classic split (nginx in front).
   */
  CLIENT_DIST_DIR: string | undefined;
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

  // Render (and PaaSes generally) expose the service's public https URL; when
  // the SPA is served by this same process, the API's public origin IS the
  // client origin, so both URLs derive from it. Explicit env still wins.
  const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");

  const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || RENDER_EXTERNAL_URL;
  if (!BETTER_AUTH_URL) problems.push(`BETTER_AUTH_URL is missing. ${hint}`);

  const CLIENT_URL = process.env.CLIENT_URL || RENDER_EXTERNAL_URL;
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

  const rawTrustProxy = (process.env.TRUST_PROXY ?? "").trim().toLowerCase();
  if (rawTrustProxy && !["1", "true", "yes", "on"].includes(rawTrustProxy)) {
    problems.push(
      `TRUST_PROXY=${JSON.stringify(process.env.TRUST_PROXY)} is not a boolean — use true or false.`,
    );
  }
  const TRUST_PROXY = ["1", "true", "yes", "on"].includes(rawTrustProxy);

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || undefined;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || undefined;
  if ((GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET) || (!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)) {
    problems.push("Google OAuth needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or neither).");
  }

  // Mail. `MAIL_PROVIDER` defaults to `none` — an unconfigured app must still
  // boot, or every local run and every test would need a provider account.
  // Selecting `reloop` without credentials, though, is a misconfiguration that
  // would fail silently at the first password reset, so it is fatal here.
  const rawMailProvider = (process.env.MAIL_PROVIDER ?? "").trim().toLowerCase();
  let MAIL_PROVIDER: Env["MAIL_PROVIDER"] = "none";
  if (rawMailProvider) {
    if (rawMailProvider === "none" || rawMailProvider === "reloop") {
      MAIL_PROVIDER = rawMailProvider;
    } else {
      problems.push(
        `MAIL_PROVIDER=${JSON.stringify(process.env.MAIL_PROVIDER)} is not one of none|reloop.`,
      );
    }
  }

  const RELOOP_API_KEY = process.env.RELOOP_API_KEY || undefined;
  const RELOOP_FROM = process.env.RELOOP_FROM || undefined;
  if (MAIL_PROVIDER === "reloop") {
    if (!RELOOP_API_KEY) problems.push("MAIL_PROVIDER=reloop needs RELOOP_API_KEY.");
    if (!RELOOP_FROM) problems.push("MAIL_PROVIDER=reloop needs RELOOP_FROM (a verified sender address).");
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
    MAIL_PROVIDER,
    RELOOP_API_KEY,
    RELOOP_FROM,
    TRUST_PROXY,
    CLIENT_DIST_DIR: process.env.CLIENT_DIST_DIR || undefined,
  };
}

export const env = validate();
