import { db } from "../../db";
import { user } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function createTestUser() {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    name: "Test User",
    password: "Test1234!",
  };

  const res = await fetch("http://localhost:3000/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testUser),
  });

  const data = await res.json();
  return {
    user: data.user,
    email: testUser.email,
    password: testUser.password,
  };
}

export async function getAuthToken(email: string, password: string) {
  const res = await fetch("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  return data.session?.token || data.token;
}

export async function cleanupTestUser(userId: string) {
  await db.delete(user).where(eq(user.id, userId));
}
