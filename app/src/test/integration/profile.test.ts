import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { db } from "../../db";
import { user } from "../../db/schema";
import { eq } from "drizzle-orm";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

// No-op: better-auth's credential limiter is disabled under NODE_ENV=test (see
// `rateLimit` in utils/auth.ts) because this suite creates dozens of accounts.
// Kept as a function so the intent stays visible at the call sites.
function pauseForAuthRateLimit() {}

const patchProfile = (cookie: string, body: Record<string, unknown>) =>
  app.handle(
    new Request("http://localhost/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    }),
  );

describe("auto-assigned usernames (phase 3 PR 1)", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await cleanupTestUser(id);
  });

  async function signUp(name: string) {
    await pauseForAuthRateLimit();
    const email = `ident-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password: "Test1234!" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    created.push(body.user.id);
    return { email, body };
  }

  test("derives a username from the display name", async () => {
    // Assert the derivation, not an exact value: the test database is shared and
    // a previous run may already own `alice_smith`.
    const { body } = await signUp("Alice Smith");
    expect(body.user.username).toMatch(/^alice_smith(_\d+)?$/);
  });

  test("returns the username on the sign-up response, not null", async () => {
    // Assigned in a `create.before` hook so it is part of the INSERT. An
    // `after` hook would leave the sign-up response reporting `null` until the
    // client's next fetch, which is what a first-run `/u/:username` link needs.
    const { body } = await signUp("Grace Hopper");
    expect(body.user.username).toMatch(/^grace_hopper(_\d+)?$/);
  });

  test("falls back when the name has too little usable material", async () => {
    const { body } = await signUp("RL");
    // "rl" is below the 3-character minimum, so it must not become the username.
    expect(body.user.username.length).toBeGreaterThanOrEqual(3);
  });

  test("never assigns a reserved word", async () => {
    for (const name of ["Admin", "Explore"]) {
      const { body } = await signUp(name);
      expect(["admin", "explore"]).not.toContain(body.user.username);
      expect(body.user.username.startsWith(name.toLowerCase())).toBe(true);
    }
  });

  test("de-duplicates accounts sharing a display name", async () => {
    const a = await signUp("Kai Nguyen");
    const b = await signUp("Kai Nguyen");
    // Both derive from the same name, so both match this shape...
    for (const username of [a.body.user.username, b.body.user.username]) {
      expect(username).toMatch(/^kai_nguyen(_\d+)?$/);
    }
    // ...but the second must not collide with the first.
    expect(a.body.user.username).not.toBe(b.body.user.username);
  });

  test("every assigned username passes validation rules", async () => {
    for (const name of ["Alice Smith", "Jo", "🎉 Emoji", "  padded  "]) {
      const { body } = await signUp(name);
      const username = body.user.username as string;
      expect(username).toMatch(/^[a-z0-9_]{3,30}$/);
    }
  });

  test("the assigned username persists to the row", async () => {
    const { email, body } = await signUp("Persisted User");
    const [row] = await db
      .select({ username: user.username })
      .from(user)
      .where(eq(user.email, email));
    expect(row?.username).toBe(body.user.username);
  });
});

describe("sign-in with username (phase 3 PR 1)", () => {
  let cookie: string;
  let username: string;

  beforeAll(async () => {
    const testUser = await createTestUser();
    await patchProfile(await getSessionCookie(testUser.email, testUser.password), {
      username: `sio_${Date.now()}`,
    });
    const [row] = await db
      .select({ username: user.username })
      .from(user)
      .where(eq(user.id, testUser.user.id));
    username = row!.username!;
    cookie = await getSessionCookie(testUser.email, testUser.password);
    expect(cookie).toBeTruthy();
  });

  afterAll(async () => {
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
    if (row) await cleanupTestUser(row.id);
  });

  test("accepts a correct username and password", async () => {
    await pauseForAuthRateLimit();
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "Test1234!" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.username).toBe(username);
  });

  test("is case-insensitive on the username", async () => {
    await pauseForAuthRateLimit();
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.toUpperCase(), password: "Test1234!" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  test("rejects a wrong password without revealing the account exists", async () => {
    await pauseForAuthRateLimit();
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "WrongPassword1!" }),
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Invalid username or password");
  });

  test("rejects an unknown username with the same message", async () => {
    await pauseForAuthRateLimit();
    const res = await app.handle(
      new Request("http://localhost/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "nobody_here_at_all", password: "Test1234!" }),
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    // Identical to the wrong-password case, so the endpoint cannot be used to
    // enumerate which usernames exist.
    expect(body.message).toBe("Invalid username or password");
  });

  test("rejects a mixed-case variant of another user's username", async () => {
    const other = await createTestUser();
    const otherCookie = await getSessionCookie(other.email, other.password);
    const name = `case_${Date.now()}`;
    expect((await patchProfile(otherCookie, { username: name })).status).toBe(200);
    // "CASE_x" must collide with the already-taken "case_x".
    const dup = await patchProfile(cookie, { username: name.toUpperCase() });
    expect(dup.status).toBe(409);
    await cleanupTestUser(other.user.id);
  });

  test("reports username availability", async () => {
    const taken = await app.handle(
      new Request("http://localhost/api/auth/is-username-available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      }),
    );
    expect((await taken.json()).available).toBe(false);

    const free = await app.handle(
      new Request("http://localhost/api/auth/is-username-available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: `free_${Date.now()}` }),
      }),
    );
    expect((await free.json()).available).toBe(true);
  });
});

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
    // Note these contain no case issue: the route validates the *lower-cased*
    // form, matching the plugin's post-normalization order, so "Alice" is valid
    // (and stored as `alice`) while these are not.
    for (const bad of ["has space", "bad-dash", "n@me"]) {
      const res = await patchProfile(cookie, { username: bad });
      expect(res.status).toBe(409);
    }
  });

  test("normalises a mixed-case username to lower case", async () => {
    const mixed = `MiXeD_${Date.now()}`;
    const res = await patchProfile(cookie, { username: mixed });
    expect(res.status).toBe(200);
    // Stored lower-case, so the public URL is stable and the case-insensitive
    // availability lookup in better-auth can find it.
    expect((await res.json()).username).toBe(mixed.toLowerCase());
  });

  test("rejects a mixed-case variant of another user's username", async () => {
    const other = await createTestUser();
    const otherCookie = await getSessionCookie(other.email, other.password);
    const name = `case_${Date.now()}`;
    expect((await patchProfile(otherCookie, { username: name })).status).toBe(200);
    // "CASE_x" must collide with the already-taken "case_x".
    const dup = await patchProfile(cookie, { username: name.toUpperCase() });
    expect(dup.status).toBe(409);
    await cleanupTestUser(other.user.id);
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
