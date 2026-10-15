// Single-process deployment (docs/DEPLOY.md): when CLIENT_DIST_DIR is set the
// API serves the built SPA from its own origin, replacing the nginx static
// tier. Elysia's router prefers registered routes over the catch-all, so API
// paths keep winning and everything unmatched is a dist file or the SPA shell.

import path from "node:path";
import { env } from "../env";

const DIST_DIR = env.CLIENT_DIST_DIR;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export function spaEnabled(): boolean {
  return DIST_DIR !== undefined;
}

let cachedIndex: Promise<string> | null = null;

function indexHtml(): Promise<string> {
  cachedIndex ??= Bun.file(path.join(DIST_DIR!, "index.html")).text();
  return cachedIndex;
}

/** The SPA shell for client-side routes. */
export async function spaIndexResponse(): Promise<Response> {
  return new Response(await indexHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Hashed assets are immutable, but the shell references them by name —
      // a new deploy must never come from a browser cache.
      "Cache-Control": "no-cache",
    },
  });
}

/** A dist file by URL path, or null when no such file exists. */
export async function spaAssetResponse(urlPath: string): Promise<Response | null> {
  if (!DIST_DIR) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  // Contain the lookup inside dist: normalize first, then verify the result
  // stayed under the directory (rejects `../../etc/passwd` and friends).
  const resolved = path.resolve(
    DIST_DIR,
    `.${path.posix.normalize(`/${decoded}`)}`,
  );
  if (resolved !== DIST_DIR && !resolved.startsWith(`${DIST_DIR}${path.sep}`)) {
    return null;
  }

  const file = Bun.file(resolved);
  if (!(await file.exists())) return null;

  const type = MIME_TYPES[path.extname(resolved).toLowerCase()];
  return new Response(file, {
    headers: {
      ...(type ? { "Content-Type": type } : {}),
      // Vite fingerprints everything under /assets/; the rest (favicon,
      // fonts, robots.txt) changes with deploys — revalidate, don't guess.
      "Cache-Control": decoded.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600",
    },
  });
}

/**
 * True when the request is a document navigation — someone opening the URL —
 * rather than a data fetch. Browsers mark navigations with
 * `Sec-Fetch-Mode: navigate`; `fetch()` sends `cors` or `same-origin`. Older
 * browsers send no Sec-Fetch headers at all, but their navigations advertise
 * text/html in Accept while `fetch()` defaults to a wildcard Accept. This is
 * what lets the public pages return the SPA shell to a browser and JSON to
 * the app's own queries without path tricks — the API and the pages share
 * the URLs.
 */
export function wantsHtmlDocument(request: Request): boolean {
  const secFetchMode = request.headers.get("sec-fetch-mode");
  if (secFetchMode !== null) return secFetchMode === "navigate";
  return (request.headers.get("accept") ?? "").includes("text/html");
}
