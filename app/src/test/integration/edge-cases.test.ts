import { describe, test, expect, beforeAll } from "bun:test";
import { app } from "../../index";
import { createTestUser, getAuthToken } from "./setup";

describe("edge cases", () => {
  let token: string;

  beforeAll(async () => {
    const user = await createTestUser();
    token = await getAuthToken(user.email, user.password);
  });

  // test("handles very long urls", async () => {
  //   const longUrl = "https://example.com/" + "a".repeat(3000);
  // });

  test("handles unicode in titles", async () => {
    const res = await app.handle(
      new Request("http://localhost/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: "https://example.com",
          title: "测试 🚀 тест",
        }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
