import { describe, test, expect, afterAll } from "bun:test";
import { app } from "../../index";
import { env } from "../../env";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

/**
 * Crawler-served HTML (ADR-002).
 *
 * A crawler must get Open Graph tags; a browser must get exactly the JSON it
 * got before, or the whole SPA breaks. Both assertions matter.
 */

const UA = {
  twitter: "Twitterbot/1.0",
  slack: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  discord: "Discordbot/2.0",
  browser:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const get = (path: string, userAgent?: string) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      headers: userAgent ? { "User-Agent": userAgent } : undefined,
    }),
  );

/** Authenticated JSON call. Reads the body exactly once. */
async function authed(
  cookie: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...(init.headers as Record<string, string> | undefined),
      },
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

type Fixture = {
  userId: string;
  cookie: string;
  username: string;
  slug: string;
  shareCode: string;
};

let fixture: Fixture | null = null;

async function setup() {
  const testUser = await createTestUser();
  const cookie = await getSessionCookie(testUser.email, testUser.password);
  const username = `crawl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const auth = (path: string, init: RequestInit = {}) => authed(cookie, path, init);

  const profile = await auth("/user/profile", {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
  expect(profile.status).toBe(200);

  const col = (
    await auth("/collections", {
      method: "POST",
      body: JSON.stringify({ name: "Crawler Test Collection" }),
    })
  ).body;
  const published = (
    await auth(`/collections/${col.id}`, {
      method: "PATCH",
      body: JSON.stringify({ visibility: "public" }),
    })
  ).body;
  const share = (
    await auth(`/collections/${col.id}/share`, { method: "POST" })
  ).body;

  fixture = {
    userId: testUser.user.id,
    cookie,
    username,
    slug: published.slug,
    shareCode: share.shareCode,
  };
  return fixture;
}

afterAll(async () => {
  if (fixture) await cleanupTestUser(fixture.userId);
});

describe("crawler HTML on public routes", () => {
  test("a profile returns OG tags to a crawler", async () => {
    const f = await setup();
    const res = await get(`/u/${f.username}`, UA.twitter);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain(`@${f.username}`);
    expect(html).toContain('<meta property="og:type" content="profile">');
    expect(html).toContain(`<link rel="canonical" href="`);
    expect(html).toContain(`/u/${f.username}`);
    expect(html).toContain('<meta property="og:image"');
    expect(html).toContain('/og/profile/');
    // ADR-002: a link-preview surface, not an SEO one.
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  test("a public collection returns OG tags to a crawler", async () => {
    const f = await setup();
    const res = await get(`/u/${f.username}/${f.slug}`, UA.slack);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("Crawler Test Collection");
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain(`<link rel="canonical" href="`);
    expect(html).toContain(`/u/${f.username}/${f.slug}`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  test("a share code returns OG tags, canonicalised to the readable URL", async () => {
    const f = await setup();
    const res = await get(`/share/${f.shareCode}`, UA.discord);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    // The canonical is the owner's readable URL even though the crawler
    // arrived via the code — so a link a platform stores can be changed by
    // the owner without it going stale.
    const origin = env.CLIENT_URL.replace(/\/$/, "");
    expect(html).toContain(
      `<link rel="canonical" href="${origin}/u/${f.username}/${f.slug}">`,
    );
  });

  test("every common crawler gets HTML", async () => {
    const f = await setup();
    for (const ua of [
      UA.twitter,
      UA.slack,
      UA.discord,
      "facebookexternalhit/1.1",
      "TelegramBot (like TwitterBot)",
      "WhatsApp/2.21.12.0",
      "LinkedInBot/1.0",
    ]) {
      const res = await get(`/u/${f.username}/${f.slug}`, ua);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    }
  });

  test("a browser still gets JSON, unchanged", async () => {
    const f = await setup();
    for (const path of [
      `/u/${f.username}`,
      `/u/${f.username}/${f.slug}`,
      `/share/${f.shareCode}`,
    ]) {
      const res = await get(path, UA.browser);
      expect(res.headers.get("content-type")).toContain("application/json");
      const body = await res.json();
      expect(typeof body).toBe("object");
    }
  });

  test("a request with no User-Agent gets JSON", async () => {
    // Our own tooling sends none. Guessing "crawler" here would hand it HTML.
    const f = await setup();
    const res = await get(`/u/${f.username}`);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("our test tooling is not mistaken for a crawler", async () => {
    const f = await setup();
    const res = await get(`/u/${f.username}`, "Bun/1.4.2");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test("escapes a hostile collection name in the crawler document", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    const auth = (path: string, init: RequestInit = {}) => authed(cookie, path, init);

    const username = `xss_${Date.now().toString(36)}`;
    await auth("/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ username }),
    });
    const marker = "xssmarker";
    const col = (
      await auth("/collections", {
        method: "POST",
        body: JSON.stringify({
          name: `<script>${marker}</script>`,
          description: `"><img src=x onerror=${marker}>`,
          // The name slugifies to nothing (every character is stripped), so
          // give an explicit slug to reach the crawler document at all.
          slug: "xss-collection",
        }),
      })
    ).body;
    const published = (
      await auth(`/collections/${col.id}`, {
        method: "PATCH",
        body: JSON.stringify({ visibility: "public" }),
      })
    ).body;

    const res = await get(`/u/${username}/${published.slug}`, UA.twitter);
    expect(res.status).toBe(200);
    const html = await res.text();
    // The payloads survive as inert escaped text — no tag is created from them.
    // Asserting on the absence of the *tag*, not the substring `onerror=`,
    // which correctly still appears inside an escaped attribute value.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=xssmarker&gt;");

    await cleanupTestUser(testUser.user.id);
  });

  test("a 404 stays a 404 for crawlers too", async () => {
    const f = await setup();
    const res = await get(`/u/${f.username}/no-such-slug`, UA.twitter);
    expect(res.status).toBe(404);
  });
});