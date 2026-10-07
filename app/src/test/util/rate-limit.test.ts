import { describe, test, expect, beforeEach } from "bun:test";
import { consumeRateLimit, resetRateLimits } from "../../utils/rate-limit";

describe("consumeRateLimit", () => {
  beforeEach(() => resetRateLimits());

  test("allows exactly `limit` requests inside one window", () => {
    for (let i = 1; i <= 3; i++) {
      const result = consumeRateLimit("k", 3, 60_000, 1_000);
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(3 - i);
    }

    const blocked = consumeRateLimit("k", 3, 60_000, 1_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  test("counts each key separately", () => {
    expect(consumeRateLimit("a", 1, 60_000, 0).ok).toBe(true);
    expect(consumeRateLimit("b", 1, 60_000, 0).ok).toBe(true);
    expect(consumeRateLimit("a", 1, 60_000, 0).ok).toBe(false);
  });

  test("starts a fresh window once the old one expires", () => {
    expect(consumeRateLimit("k", 1, 1_000, 0).ok).toBe(true);
    expect(consumeRateLimit("k", 1, 1_000, 500).ok).toBe(false);
    // window 0 + 1000ms has elapsed
    expect(consumeRateLimit("k", 1, 1_000, 1_000).ok).toBe(true);
  });

  test("reports when the current window resets", () => {
    const result = consumeRateLimit("k", 5, 60_000, 1_000);
    expect(result.resetAt).toBe(61_000);
  });
});