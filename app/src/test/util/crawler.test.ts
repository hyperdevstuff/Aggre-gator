import { describe, expect, test } from "bun:test";
import { isCrawler } from "../../utils/crawler";

describe("isCrawler", () => {
  test("recognises the link-preview crawlers that matter", () => {
    const agents = [
      "Twitterbot/1.0",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Slack-ImgProxy (+https://api.slack.com/imagesproxy)",
      "Discordbot/2.0",
      "TelegramBot (like TwitterBot)",
      "WhatsApp/2.21.12.0 A",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0)",
      "Pinterest/0.2 (+http://www.pinterest.com/bot.html)",
      "redditbot/1.0",
      "SkypeUriPreview Preview/1.0",
      "Embedly/0.2 (+http://support.embed.ly/)",
      "opengraph",
      "SomeUnknownPreviewFetcher/1.0",
    ];
    for (const agent of agents) {
      expect(isCrawler(agent)).toBe(true);
    }
  });

  test("recognises generic bots, crawlers and spiders", () => {
    for (const agent of ["SomeBot/1.0", "MyCrawler", "x-spider-y"]) {
      expect(isCrawler(agent)).toBe(true);
    }
  });

  test("treats ordinary browsers as humans", () => {
    const browsers = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    ];
    for (const agent of browsers) {
      expect(isCrawler(agent)).toBe(false);
    }
  });

  test("excludes search engines, which execute JavaScript", () => {
    // ADR-002: we are not an SEO surface, and these crawlers prefer the real
    // page. Serving them the bodyless document would only hurt.
    expect(isCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(false);
    expect(isCrawler("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(false);
  });

  test("excludes our own tooling, which must reach the JSON API", () => {
    // These fetch the API from the test suite and from health checks. Serving
    // them HTML would break every integration test.
    expect(isCrawler("Bun/1.4.2")).toBe(false);
    expect(isCrawler("curl/8.5.0")).toBe(false);
    expect(isCrawler("node-fetch/1.0")).toBe(false);
    expect(isCrawler("python-requests/2.32.0")).toBe(false);
    expect(isCrawler("PostmanRuntime/7.39.0")).toBe(false);
    expect(isCrawler("Go-http-client/2.0")).toBe(false);
  });

  test("treats a missing User-Agent as a human", () => {
    // Plenty of legitimate tooling sends none, and misclassifying it would show
    // a blank page to someone real.
    expect(isCrawler(null)).toBe(false);
    expect(isCrawler(undefined)).toBe(false);
    expect(isCrawler("")).toBe(false);
  });

  test("is case-insensitive", () => {
    expect(isCrawler("TWITTERBOT/1.0")).toBe(true);
    expect(isCrawler("discordbot")).toBe(true);
  });

  test("an exclusion wins over an inclusion in the same string", () => {
    // "Googlebot" contains "bot", so order matters: the exclusion must be
    // checked first or every exclusion would be unreachable.
    expect(isCrawler("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(false);
  });
});