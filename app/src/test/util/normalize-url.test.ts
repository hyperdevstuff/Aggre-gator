import { describe, test, expect } from "bun:test";
import { normalizeUrl } from "../../utils/normalize-url";

describe("normalizeUrl", () => {
  test("lowercases scheme and host", () => {
    expect(normalizeUrl("HTTPS://Example.COM/foo")).toBe("https://example.com/foo");
    expect(normalizeUrl("Http://EXAMPLE.com/")).toBe("http://example.com/");
  });

  test("drops default ports", () => {
    expect(normalizeUrl("https://example.com:443/foo")).toBe("https://example.com/foo");
    expect(normalizeUrl("http://example.com:80/foo")).toBe("http://example.com/foo");
    expect(normalizeUrl("https://example.com:8080/foo")).toBe("https://example.com:8080/foo");
  });

  test("resolves dot segments", () => {
    expect(normalizeUrl("https://example.com/a/../b")).toBe("https://example.com/b");
    expect(normalizeUrl("https://example.com/a/./b")).toBe("https://example.com/a/b");
    expect(normalizeUrl("https://example.com/a/b/../..")).toBe("https://example.com/");
  });

  test("collapses duplicate slashes", () => {
    expect(normalizeUrl("https://example.com/a//b///c")).toBe("https://example.com/a/b/c");
  });

  test("strips a single trailing slash on non-root paths", () => {
    expect(normalizeUrl("https://example.com/foo/")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo/bar/")).toBe("https://example.com/foo/bar");
  });

  test("keeps the root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  test("strips the fragment", () => {
    expect(normalizeUrl("https://example.com/foo#section")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo#")).toBe("https://example.com/foo");
  });

  test("sorts query params", () => {
    expect(normalizeUrl("https://example.com/foo?b=2&a=1")).toBe(
      "https://example.com/foo?a=1&b=2",
    );
  });

  test("strips enumerated tracking params", () => {
    expect(normalizeUrl("https://example.com/foo?utm_source=x&utm_medium=y")).toBe(
      "https://example.com/foo",
    );
    expect(normalizeUrl("https://example.com/foo?gclid=abc")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo?fbclid=abc")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo?msclkid=abc")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo?yclid=abc")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo?mc_eid=abc")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo?igshid=abc")).toBe("https://example.com/foo");
    expect(normalizeUrl("https://example.com/foo?ref=abc")).toBe("https://example.com/foo");
  });

  test("strips utm_ prefix variants", () => {
    expect(normalizeUrl("https://example.com/foo?utm_campaign=x&utm_term=y")).toBe(
      "https://example.com/foo",
    );
  });

  test("keeps ambiguous params", () => {
    // `ref` is tracked, but `referrer` and `reference` are not.
    expect(normalizeUrl("https://example.com/foo?referrer=bar")).toBe(
      "https://example.com/foo?referrer=bar",
    );
    expect(normalizeUrl("https://example.com/foo?reference=bar")).toBe(
      "https://example.com/foo?reference=bar",
    );
    // Anything not on the list survives, including unknowns.
    expect(normalizeUrl("https://example.com/foo?foo=bar&baz=qux")).toBe(
      "https://example.com/foo?baz=qux&foo=bar",
    );
  });

  test("keeps path case", () => {
    expect(normalizeUrl("https://example.com/Foo/Bar")).toBe("https://example.com/Foo/Bar");
  });

  test("keeps www", () => {
    expect(normalizeUrl("https://www.example.com/foo")).toBe("https://www.example.com/foo");
  });

  test("drops the fragment", () => {
    expect(normalizeUrl("https://example.com/foo#bar")).toBe("https://example.com/foo");
  });

  test("mixed: tracking stripped, rest sorted, path preserved", () => {
    expect(
      normalizeUrl("https://Example.COM:443/Foo/?utm_source=x&b=2&a=1#frag"),
    ).toBe("https://example.com/Foo?a=1&b=2");
  });

  test("throws on invalid input", () => {
    expect(() => normalizeUrl("not a url")).toThrow();
    expect(() => normalizeUrl("")).toThrow();
  });

  test("preserves userinfo", () => {
    expect(normalizeUrl("https://user:pass@example.com/foo")).toBe(
      "https://user:pass@example.com/foo",
    );
  });

  test("tracking param matching is case-insensitive", () => {
    expect(normalizeUrl("https://example.com/foo?UTM_SOURCE=x&GCLID=y")).toBe(
      "https://example.com/foo",
    );
  });
});