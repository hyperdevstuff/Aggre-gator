/**
 * The static HTML document served to link-preview crawlers.
 *
 * Every value here is user-controlled — collection names, descriptions, bios,
 * usernames — and it is interpolated into markup that a third party renders.
 * `escapeHtml` is therefore a security requirement, not a nicety: without it a
 * collection named `<script>…</script>` executes in a Slack or Discord preview.
 */

export type CrawlerDocumentInput = {
  title: string;
  description?: string | null;
  /** Absolute URL of the preview image. */
  image?: string | null;
  /** Absolute canonical URL of the page. */
  url: string;
  /** `article` for a collection, `profile` for a user page. */
  type?: "website" | "profile" | "article";
  siteName?: string;
  /** Renderer for the few characters crawlers expect verbatim. */
  locale?: string;
};

/** Escape for HTML text and double-quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Clip a description to a length crawlers will display, on a word boundary and
 * without adding an ellipsis character (some previews render it literally).
 */
export function clampText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const clipped = trimmed.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trim();
}

/**
 * A minimal, valid HTML document. Deliberately *not* a shell for the SPA: the
 * ADR is explicit that we are not claiming SEO value, and an empty body that
 * loads the real app for a human while showing crawlers the metadata is the
 * behaviour we want.
 */
export function renderCrawlerDocument(input: CrawlerDocumentInput): string {
  const {
    title,
    description,
    image,
    url,
    type = "website",
    siteName = "Aggregator",
    locale = "en",
  } = input;

  const safeTitle = escapeHtml(clampText(title, 120));
  const safeDescription = description
    ? escapeHtml(clampText(description, 300))
    : null;
  const safeUrl = escapeHtml(url);
  const safeImage = image ? escapeHtml(image) : null;

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
${safeDescription ? `<meta name="description" content="${safeDescription}">` : ""}
<link rel="canonical" href="${safeUrl}">
<meta property="og:type" content="${escapeHtml(type)}">
<meta property="og:site_name" content="${escapeHtml(siteName)}">
<meta property="og:title" content="${safeTitle}">
${safeDescription ? `<meta property="og:description" content="${safeDescription}">` : ""}
<meta property="og:url" content="${safeUrl}">
${
  safeImage
    ? `<meta property="og:image" content="${safeImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">`
    : ""
}
<meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${safeTitle}">
${safeDescription ? `<meta name="twitter:description" content="${safeDescription}">` : ""}
${safeImage ? `<meta name="twitter:image" content="${safeImage}">` : ""}
<meta name="theme-color" content="#0b0f14">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body>
<main>
<h1>${safeTitle}</h1>
${safeDescription ? `<p>${safeDescription}</p>` : ""}
<p><a href="${safeUrl}">Open on Aggregator</a></p>
</main>
</body>
</html>`;
}