import { describe, test, expect, afterEach } from "bun:test";
import {
  assertSafeToFetch,
  isBlockedAddress,
  resetHostResolver,
  setHostResolver,
  UnsafeUrlError,
} from "../../utils/url-guard";

describe("isBlockedAddress", () => {
  test("blocks loopback, private, link-local and reserved IPv4", () => {
    const blocked = [
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1", // CGNAT
      "127.0.0.1",
      "169.254.169.254", // cloud instance metadata
      "172.16.0.1",
      "172.31.255.254",
      "192.0.0.1",
      "192.168.1.1",
      "198.18.0.1", // benchmarking
      "224.0.0.1", // multicast
      "255.255.255.255",
    ];
    for (const ip of blocked) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
  });

  test("blocks loopback, unique-local, link-local and mapped IPv6", () => {
    const blocked = [
      "::",
      "::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.5",
      "fc00::1",
      "fd12:3456:789a::1",
      "fe80::1",
      "fe80::1%eth0", // zone index must not defeat the check
      "ff02::1",
    ];
    for (const ip of blocked) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
  });

  test("allows publicly routable addresses", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.15.0.1", "172.32.0.1", "2606:4700::1"]) {
      expect(isBlockedAddress(ip)).toBe(false);
    }
  });

  test("treats anything that is not an IP literal as blocked", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("assertSafeToFetch", () => {
  afterEach(() => resetHostResolver());

  test("rejects non-http(s) protocols", async () => {
    for (const url of [
      "file:///etc/passwd",
      "gopher://127.0.0.1/",
      "ftp://example.com/",
      "data:text/html,<h1>hi</h1>",
    ]) {
      expect(assertSafeToFetch(url)).rejects.toBeInstanceOf(UnsafeUrlError);
    }
  });

  test("rejects a hostname that resolves to loopback", async () => {
    setHostResolver(async () => ["127.0.0.1"]);
    expect(assertSafeToFetch("http://internal.example.com/")).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  test("rejects when only one answer in a multi-record lookup is private", async () => {
    setHostResolver(async () => ["93.184.216.34", "169.254.169.254"]);
    expect(assertSafeToFetch("https://mixed.example.com/")).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  test("rejects IPv4 literals without touching DNS", async () => {
    let lookedUp = false;
    setHostResolver(async () => {
      lookedUp = true;
      return ["93.184.216.34"];
    });
    expect(assertSafeToFetch("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
    expect(lookedUp).toBe(false);
  });

  test("rejects a hostname that does not resolve", async () => {
    setHostResolver(async () => []);
    expect(assertSafeToFetch("https://empty.example.com/")).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  test("rejects when the lookup itself fails", async () => {
    setHostResolver(async () => {
      throw new Error("ENOTFOUND");
    });
    expect(assertSafeToFetch("https://nope.example.com/")).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  test("accepts a public https URL and returns it parsed", async () => {
    setHostResolver(async () => ["93.184.216.34"]);
    const url = await assertSafeToFetch("https://example.com/some/page");
    expect(url.hostname).toBe("example.com");
    expect(url.pathname).toBe("/some/page");
  });
});