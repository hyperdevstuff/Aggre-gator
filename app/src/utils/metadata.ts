import metascraper from "metascraper";
import metascraperDescription from "metascraper-description";
import metascraperImage from "metascraper-image";
import metascraperTitle from "metascraper-title";
import metascraperUrl from "metascraper-url";

const scraper = metascraper([
  metascraperDescription(),
  metascraperImage(),
  metascraperTitle(),
  metascraperUrl(),
]);

export default async function scrapeMetadata(targeturl: string) {
  try {
    const response = await fetch(targeturl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`http ${response.status}`);
    const html = await response.text();
    const metadata = await scraper({ html, url: targeturl });
    return {
      title: metadata.title || new URL(targeturl).hostname,
      description: metadata.description || "",
      image: metadata.image || "",
      domain: new URL(targeturl).hostname,
      url: metadata.url,
    };
  } catch (e) {
    console.error(e);
    return {
      title: new URL(targeturl).hostname,
      domain: new URL(targeturl).hostname,
      image: null,
      description: null,
      url: targeturl,
    };
  }
}
