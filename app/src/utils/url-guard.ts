/**
 * SSRF guard for server-side fetches of user-supplied URLs.
 *
 * `POST /bookmarks` makes the API fetch whatever URL the user pastes. Without
 * this guard that is a server-side request forgery hole: `http://127.0.0.1:3001`,
 * `http://169.254.169.254/latest/meta-data/` (cloud instance credentials),
 * `http://10.0.0.5/` and friends all resolve and return to the attacker.
 *
 * The rule is "public internet only": http/https, and every address the
 * hostname resolves to must be a globally routable unicast address. Resolution
 * failures are refused too — a name that does not resolve cannot be a page we
 * are willing to fetch.
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * RFC1918 / loopback / link-local / CGNAT / multicast / reserved ranges.
 * Cloud metadata lives at 169.254.169.254, which the link-local rule covers.
 */
function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".");
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (a === 0) return true; // "this" network (0.0.0.0/8)
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments + TEST-NET
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isBlockedIPv6(address: string): boolean {
  // Strip the zone index (fe80::1%eth0) before any parsing.
  const bare = address.toLowerCase().split("%")[0];
  if (bare === "::" || bare === "::1") return true;

  // IPv4-mapped / IPv4-compatible forms embed a v4 address — judge the v4.
  const embedded = bare.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (embedded && net.isIPv4(embedded)) return isBlockedIPv4(embedded);

  const firstHextet = parseInt(bare.split(":")[0] || "0", 16);
  if (Number.isNaN(firstHextet)) return true;
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** True for anything that is not a public unicast address (including junk). */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true;
}

export type HostResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true });
  return results.map((result) => result.address);
};

let resolver: HostResolver = defaultResolver;

/** Test seam: swap the DNS resolver so guard tests need no live DNS. */
export function setHostResolver(next: HostResolver) {
  resolver = next;
}

export function resetHostResolver() {
  resolver = defaultResolver;
}

/**
 * Validate that `rawUrl` is safe for the server to fetch, returning the parsed
 * URL. Throws `UnsafeUrlError` for any non-http(s) protocol or any hostname
 * whose resolved addresses include a private/reserved one.
 *
 * Call this again for every redirect hop: a public URL can 302 to
 * `http://169.254.169.254/` and land back inside the network.
 */
export async function assertSafeToFetch(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`malformed URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`protocol not allowed: ${url.protocol}`);
  }

  // Bracketed IPv6 literals arrive as "[::1]" on the URL object.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) throw new UnsafeUrlError("URL has no hostname");

  const literal = net.isIP(hostname);
  const addresses = literal
    ? [hostname]
    : await resolver(hostname).catch((error: unknown) => {
        throw new UnsafeUrlError(
          `DNS lookup failed for ${hostname}: ${error instanceof Error ? error.message : error}`,
        );
      });

  if (addresses.length === 0) {
    throw new UnsafeUrlError(`DNS lookup for ${hostname} returned no addresses`);
  }

  // Every answer must be public: a single private record in a multi-record
  // answer is enough to reach an internal host.
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new UnsafeUrlError(`${hostname} resolves to a non-public address (${address})`);
    }
  }

  return url;
}