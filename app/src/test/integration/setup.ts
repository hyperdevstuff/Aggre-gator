import { app } from "../../index";
import { db } from "../../db";
import { user } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Sign up an account.
 *
 * `verified` defaults to **true**, and that default is load-bearing: `be-07`
 * makes an unverified account unable to publish, which is correct, but it means
 * every test that publishes needs an account that has clicked the verification
 * link. Flipping the row is the honest stand-in for that click — the alternative
 * (walking the real JWT through `/api/auth/verify-email` in setup) would make
 * every unrelated test depend on the mailer working.
 *
 * Pass `verified: false` to get the unverified experience for the tests that are
 * specifically about it. Nothing else should ever want that.
 */
export async function createTestUser(options: { verified?: boolean } = {}) {
  const verified = options.verified ?? true;
  const testUser = {
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    name: "Test User",
    password: "Test1234!",
  };

  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    }),
  );

  const data = await res.json();
  if (!data?.user?.id) {
    // Sign-up failures used to surface much later as `cannot read id of
    // undefined` in whichever test happened to call this. The one that matters
    // in practice is a duplicate address, which is why the email above carries a
    // random suffix as well as the timestamp.
    throw new Error(`sign-up failed (${res.status}): ${JSON.stringify(data)}`);
  }
  if (verified) {
    await db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, data.user.id));
  }

  return {
    // Re-read so the caller's view of the account matches what the session will
    // see — a stale `emailVerified: false` here would make a test assert on a
    // state that stopped existing.
    user: { ...data.user, emailVerified: verified },
    email: testUser.email,
    password: testUser.password,
  };
}

export async function getSessionCookie(email: string, password: string) {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );

  // better-auth authenticates with a session cookie (there is no bearer plugin
  // installed), so the tests have to send the same header a browser would.
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

export async function cleanupTestUser(userId: string) {
  await db.delete(user).where(eq(user.id, userId));
}
