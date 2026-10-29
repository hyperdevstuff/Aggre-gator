/**
 * URL normalisation for the dedup key.
 *
 * ADR-001 step 1. Conservative posture: the result is a *key*, never a URL we
 * navigate to. The original is always stored and linked; this function only
 * decides whether two pasted URLs are "the same link".
 *
 * What it does:
 *  - lowercases scheme and host
 *  - drops default ports (80 / 443)
 *  - resolves `.` / `..` segments
 *  - collapses runs of slashes in the path
 *  - strips a single trailing slash on non-root paths
 *  - drops the fragment
 *  - drops an enumerated tracking-param list (`utm_*`, `gclid`, `fbclid`,
 *    `msclkid`, `yclid`, `mc_eid`, `igshid`, `ref`)
 *  - sorts the remaining query params for a stable key
 *
 * What it deliberately does **not** do:
 *  - lowercase the path (path case is load-bearing on real sites — Oracle HCM,
 *    Salesforce Workday and others 403 on a lowercased path)
 *  - strip `www` (not universally equivalent to the bare host)
 *  - strip anything not on the tracking list (a false positive costs a lost
 *    bookmark; a false negative costs a dismissed toast)
 *
 * Pure and synchronous: no I/O, no global state, trivially unit-testable.
 */
const TRACKING_PARAMS_EXACT = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "yclid",
  "mc_eid",
  "igshid",
  "ref",
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS_EXACT.has(lower)) return true;
  return lower.startsWith("utm_");
}

export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`normalizeUrl: invalid URL: ${input}`);
  }

  // Lowercase scheme and host. The path keeps its case.
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  // Drop default ports.
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  // The URL constructor already resolves `.` / `..` segments. Collapse any
  // remaining runs of slashes (e.g. from a pasted "//" in the path).
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");

  // Strip a single trailing slash on non-root paths. The root "/" stays "/".
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  // Fragments never affect the resource.
  url.hash = "";

  // Keep everything except the enumerated tracking params, then sort for a
  // stable key regardless of the order the caller pasted them in.
  const kept: [string, string][] = [];
  for (const [key, value] of new URLSearchParams(url.search)) {
    if (!isTrackingParam(key)) kept.push([key, value]);
  }
  kept.sort((a, b) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
  });
  url.search = new URLSearchParams(kept).toString();

  return url.toString();
}