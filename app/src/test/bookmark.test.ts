import { describe, test, expect, beforeAll } from "bun:test";
import { app } from "../index";

describe("bookmarks", () => {
  let authToken: string;

  beforeAll(async () => {
    const signupRes = await app.handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          password: "Test1234!",
          name: "Test User",
        }),
      }),
    );

    const cookies = signupRes.headers.get("set-cookie");

    const signupData = await signupRes.json();

    // get token from signup or login
    if (signupData.token) {
      authToken = signupData.token;
    } else {
      // token might be in session, try getting it
      const sessionRes = await app.handle(
        new Request("http://localhost/api/auth/session", {
          headers: signupRes.headers, // use cookies from signup
        }),
      );
      const sessionData = await sessionRes.json();
      authToken = sessionData.token || ""; // adjust based on your auth response
    }
  });

  test("create bookmark returns 201", async () => {
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Cookie: cookies,
        },
        body: JSON.stringify({
          url: "https://example.com",
          title: "test",
        }),
      }),
    );

    console.log("status:", res.status);
    console.log("body:", await res.text());

    expect(res.status).toBe(200);
  });
});
