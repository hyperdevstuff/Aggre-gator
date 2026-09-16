import { app } from "../../index";
import { db } from "../../db";
import { user } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function createTestUser() {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
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
  return {
    user: data.user,
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
