import { describe, test, expect, afterEach, mock, spyOn } from "bun:test";
import { app } from "../../index";
import { setHostResolver, resetHostResolver } from "../../utils/url-guard";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

/** Poll until the background enrichment has landed (or give up). */
async function waitForTitle(bookmarkId: string, cookie: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  let title = "";
  while (Date.now() < deadline) {
    const res = await app.handle(
      new Request(`http://localhost/bookmarks/${bookmarkId}`, {
        headers: { Cookie: cookie },
      }),
    );
    title = (await res.json()).title;
    if (title !== "example.com") return title;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return title;
}

describe("POST /bookmarks metadata enrichment", () => {
  afterEach(() => {
    mock.restore();
    resetHostResolver();
  });

  test("returns immediately and fills the title in afterwards", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["93.184.216.34"]);
    let fetches = 0;
    spyOn(global, "fetch").mockImplementation((async () => {
      fetches++;
      return new Response(
        `<html><head><title>Enriched Page</title>
         <meta property="og:description" content="scraped description">
         <meta property="og:image" content="https://example.com/cover.jpg">
         </head></html>`,
      );
    }) as unknown as typeof fetch);

    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ url: "https://example.com/enrich-me" }),
      }),
    );

    expect(res.status).toBe(200);
    const created = await res.json();
    // The response is not blocked on the scrape: the hostname is the placeholder.
    expect(created.title).toBe("example.com");
    expect(fetches).toBe(0);

    const title = await waitForTitle(created.id, cookie);
    expect(title).toBe("Enriched Page");

    const detail = await (
      await app.handle(
        new Request(`http://localhost/bookmarks/${created.id}`, {
          headers: { Cookie: cookie },
        }),
      )
    ).json();
    expect(detail.description).toBe("scraped description");
    expect(detail.cover).toBe("https://example.com/cover.jpg");
    // One fetch, not two.
    expect(fetches).toBe(1);

    await cleanupTestUser(testUser.user.id);
  });

  test("does not overwrite a title the user edited while the fetch was in flight", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["93.184.216.34"]);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    spyOn(global, "fetch").mockImplementation((async () => {
      await gate;
      return new Response(`<html><head><title>Scraped Title</title></head></html>`);
    }) as unknown as typeof fetch);

    const created = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ url: "https://example.com/raced-edit" }),
        }),
      )
    ).json();

    const patched = await app.handle(
      new Request(`http://localhost/bookmarks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ title: "My Own Title" }),
      }),
    );
    expect(patched.status).toBe(200);

    release?.();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const detail = await (
      await app.handle(
        new Request(`http://localhost/bookmarks/${created.id}`, {
          headers: { Cookie: cookie },
        }),
      )
    ).json();
    expect(detail.title).toBe("My Own Title");

    await cleanupTestUser(testUser.user.id);
  });

  test("keeps the hostname title when the URL is internal", async () => {
    const testUser = await createTestUser();
    const cookie = await getSessionCookie(testUser.email, testUser.password);
    setHostResolver(async () => ["10.0.0.5"]);
    const fetchSpy = spyOn(global, "fetch");

    const created = await (
      await app.handle(
        new Request("http://localhost/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ url: "http://internal.svc/bookmarks" }),
        }),
      )
    ).json();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(fetchSpy).not.toHaveBeenCalled();
    const detail = await (
      await app.handle(
        new Request(`http://localhost/bookmarks/${created.id}`, {
          headers: { Cookie: cookie },
        }),
      )
    ).json();
    expect(detail.title).toBe("internal.svc");

    await cleanupTestUser(testUser.user.id);
  });
});