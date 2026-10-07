import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

const patchProfile = (cookie: string, body: Record<string, unknown>) =>
  app.handle(
    new Request("http://localhost/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    }),
  );

describe("user profile identity (phase 2 §3.4)", () => {
  let userId: string;
  let cookie: string;

  beforeAll(async () => {
    const testUser = await createTestUser();
    userId = testUser.user.id;
    cookie = await getSessionCookie(testUser.email, testUser.password);
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test("sets username, bio and avatar; plan is not writable", async () => {
    const username = `u_${Date.now()}`;
    const res = await patchProfile(cookie, {
      username,
      bio: "Collecting links since forever.",
      avatar: "https://example.com/avatar.png",
      plan: "pro",
    });
    expect(res.status).toBe(200);
    const profile = await res.json();
    expect(profile.username).toBe(username);
    expect(profile.bio).toBe("Collecting links since forever.");
    expect(profile.avatar).toBe("https://example.com/avatar.png");
    // `plan` is server-managed and must never be settable from the client.
    expect(profile.plan).toBe("free");

    const me = await app.handle(
      new Request("http://localhost/user/me", { headers: { Cookie: cookie } }),
    );
    const meData = await me.json();
    expect(meData.username).toBe(username);
  });

  test("rejects a username that is too short at the schema level", async () => {
    const res = await patchProfile(cookie, { username: "x" });
    expect(res.status).toBe(400);
  });

  test("rejects a username the format rules refuse", async () => {
    for (const bad of ["Has_Upper", "has space", "bad-dash"]) {
      const res = await patchProfile(cookie, { username: bad });
      expect(res.status).toBe(409);
    }
  });

  test("rejects a reserved username", async () => {
    const res = await patchProfile(cookie, { username: "explore" });
    expect(res.status).toBe(409);
  });

  test("rejects a username already taken by another user", async () => {
    const other = await createTestUser();
    const otherCookie = await getSessionCookie(other.email, other.password);
    const name = `taken_${Date.now()}`;

    const first = await patchProfile(otherCookie, { username: name });
    expect(first.status).toBe(200);

    const dup = await patchProfile(cookie, { username: name });
    expect(dup.status).toBe(409);
    const err = await dup.json();
    expect(err.error).toContain("already taken");

    await cleanupTestUser(other.user.id);
  });
});
