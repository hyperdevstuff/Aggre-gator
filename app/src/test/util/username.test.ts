import { describe, expect, test } from "bun:test";
import {
  RESERVED_USERNAMES,
  slugifyUsername,
  usernameCandidates,
  validateUsername,
} from "../../utils/username";

describe("validateUsername", () => {
  test("accepts lower-case letters, digits and underscores", () => {
    expect(validateUsername("alice")).toBeUndefined();
    expect(validateUsername("alice_2")).toBeUndefined();
    expect(validateUsername("a1_")).toBeUndefined();
  });

  test("rejects anything outside the pattern", () => {
    expect(validateUsername("ab")).toBeDefined();
    expect(validateUsername("a".repeat(31))).toBeDefined();
    expect(validateUsername("alice-smith")).toBeDefined();
    expect(validateUsername("alice smith")).toBeDefined();
    expect(validateUsername("")).toBeDefined();
  });

  test("rejects reserved words", () => {
    expect(validateUsername("admin")).toBe("That username is reserved.");
    expect(validateUsername("explore")).toBe("That username is reserved.");
    // Every reserved word that could pass the format check is rejected by name
    // rather than by pattern. Short ones ("u", "og") and hyphenated ones
    // ("sign-in") fail the pattern first, but both routes still reject.
    for (const reserved of RESERVED_USERNAMES) {
      if (/^[a-z0-9_]{3,30}$/.test(reserved)) {
        expect(validateUsername(reserved)).toBe("That username is reserved.");
      }
    }
  });

  test("every reserved word is rejected, whichever check catches it", () => {
    // "u" and "og" fail the pattern before the reserved check runs; the
    // reservation is still enforced, just via a different message.
    for (const reserved of RESERVED_USERNAMES) {
      expect(validateUsername(reserved)).toBeDefined();
    }
  });
});

describe("slugifyUsername", () => {
  test("keeps clean names intact", () => {
    expect(slugifyUsername("alice")).toBe("alice");
    expect(slugifyUsername("Alice")).toBe("alice");
  });

  test("collapses separators to a single underscore", () => {
    expect(slugifyUsername("Alice Smith")).toBe("alice_smith");
    expect(slugifyUsername("alice---smith")).toBe("alice_smith");
    expect(slugifyUsername("alice_smith")).toBe("alice_smith");
  });

  test("trims leading and trailing separators", () => {
    expect(slugifyUsername("  alice  ")).toBe("alice");
    expect(slugifyUsername("!!!alice!!!")).toBe("alice");
  });

  test("truncates to the maximum without leaving a trailing separator", () => {
    const long = "a".repeat(29) + "bbbbbb";
    const slug = slugifyUsername(long);
    expect(slug.length).toBeLessThanOrEqual(30);
    expect(slug.endsWith("_")).toBe(false);
  });

  test("returns empty when too little usable material remains", () => {
    expect(slugifyUsername("Jo")).toBe("");
    expect(slugifyUsername("RL")).toBe("");
    expect(slugifyUsername("🎉")).toBe("");
    expect(slugifyUsername("")).toBe("");
    expect(slugifyUsername("   ")).toBe("");
  });
});

describe("usernameCandidates", () => {
  test("returns the slug first, then numbered fallbacks", () => {
    expect(usernameCandidates("Alice Smith").slice(0, 3)).toEqual([
      "alice_smith",
      "alice_smith_2",
      "alice_smith_3",
    ]);
  });

  test("falls back to `user` when the name yields nothing usable", () => {
    expect(usernameCandidates("Jo").slice(0, 2)).toEqual(["user", "user_2"]);
    expect(usernameCandidates("").slice(0, 2)).toEqual(["user", "user_2"]);
  });

  test("skips reserved words", () => {
    // "Admin" is reserved, so the base cannot be used at all.
    expect(usernameCandidates("Admin")).not.toContain("admin");
    expect(usernameCandidates("Admin")[0]).toBe("admin_2");
  });

  test("every candidate passes validation", () => {
    for (const seed of ["alice", "Jo", "Admin", "🎉", "a".repeat(80), "x"]) {
      const candidates = usernameCandidates(seed);
      expect(candidates.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(validateUsername(candidate)).toBeUndefined();
      }
    }
  });

  test("candidates are distinct", () => {
    const candidates = usernameCandidates("alice");
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});