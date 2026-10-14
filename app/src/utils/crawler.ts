/**
 * Crawler detection for the public routes.
 *
 * Social and messaging crawlers fetch the HTML and never execute JavaScript, so
 * a client-rendered page previews as nothing. When we recognise one we answer
 * with a small static document carrying Open Graph tags instead (see
 * `renderCrawlerDocument`).
 *
 * This is a heuristic, and deliberately so: it is how the industry does it. A
 * crawler we miss degrades to today's behaviour — an empty preview — rather
 * than breaking anything. A browser we misclassify gets HTML it cannot render,
 * which is worse, so the list errs toward excluding ordinary clients.
 *
 * Decided in `docs/decisions/002-public-page-rendering.md`.
 */

/**
 * Exact / substring markers for agents we are confident about.
 *
 * `googlebot` is deliberately absent: Google's crawler executes JavaScript and
 * prefers the real page, and serving it the stripped document would only hurt
 * indexing. This is not an SEO surface (ADR-002).
 */
const CRAWLER_TOKENS = [
  // Twitter / X
  "twitterbot",
  // Slack
  "slackbot",
  "slack-imgproxy",
  // Discord
  "discordbot",
  // Facebook / Instagram / Threads
  "facebookexternalhit",
  "facebookcatalog",
  // LinkedIn
  "linkedinbot",
  // Telegram
  "telegrambot",
  // WhatsApp
  "whatsapp",
  // Pinterest, Reddit, iMessage, Signal, Mastodon, and the common preview fetchers
  "pinterest",
  "pinterestbot",
  "redditbot",
  "applebot",
  "skypeuripreview",
  "embedly",
  "quora link preview",
  "vkshare",
  "tumblr",
  "bitlybot",
  "nuzzel",
  "iframely",
  "opengraph",
  "preview",
  "bot",
  "crawler",
  "spider",
  "headless",
];

/**
 * Agents that look like bots by token but are a real browser, or are our own
 * infrastructure. Serving them the crawler document would show a blank page to
 * a human.
 */
const NOT_CRAWLERS = [
  "googlebot",
  "bingbot",
  // Bun's fetch, curl and friends — used by our own tests and health checks.
  "bun/",
  "curl/",
  "wget/",
  "node-fetch",
  "postmanruntime",
  "insomnia",
  "apache-httpclient",
  "python-requests",
  "httpie",
  "go-http-client",
];

/**
 * True when `userAgent` looks like a link-preview crawler.
 *
 * The caller must pass the raw header. An absent or empty User-Agent is treated
 * as *not* a crawler: the default `fetch()` in a browser sends one, but plenty
 * of legitimate tooling sends none, and guessing wrong costs a human their page.
 */
export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();

  for (const marker of NOT_CRAWLERS) {
    if (ua.includes(marker)) return false;
  }
  return CRAWLER_TOKENS.some((marker) => ua.includes(marker));
}