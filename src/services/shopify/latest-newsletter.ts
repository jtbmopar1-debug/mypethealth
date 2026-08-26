const STORE_ORIGIN = "https://allgoodpetfood.co.nz";
const NEWS_FEED_URL = `${STORE_ORIGIN}/blogs/news.atom`;

export interface LatestNewsletter {
  title: string;
  url: string;
  publishedAt: string;
  description: string | null;
  imageUrl: string | null;
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function element(entry: string, name: string) {
  return entry.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "";
}

function safeStoreUrl(value: string) {
  try {
    const url = new URL(decodeHtml(value), STORE_ORIGIN);
    return url.protocol === "https:" && url.hostname === "allgoodpetfood.co.nz" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseLatestNewsletterFeed(feed: string): Omit<LatestNewsletter, "description" | "imageUrl"> | null {
  for (const match of feed.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const entry = match[1];
    const title = decodeHtml(element(entry, "title"));
    const link = entry.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1]
      ?? element(entry, "id");
    const url = safeStoreUrl(link);
    const publishedAt = decodeHtml(element(entry, "published"));

    if (/newsletter/i.test(`${title} ${url ?? ""}`) && url && !Number.isNaN(Date.parse(publishedAt))) {
      return { title, url, publishedAt: new Date(publishedAt).toISOString() };
    }
  }

  return null;
}

function metaContent(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyFirst = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const contentFirst = new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i");
  return decodeHtml(html.match(propertyFirst)?.[1] ?? html.match(contentFirst)?.[1] ?? "");
}

function safeImageUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value.replace(/^http:/i, "https:"));
    const permitted = url.hostname === "allgoodpetfood.co.nz"
      || url.hostname === "cdn.shopify.com"
      || url.hostname.endsWith(".shopifycdn.com");
    return url.protocol === "https:" && permitted ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getLatestNewsletter(): Promise<LatestNewsletter> {
  const feedResponse = await fetch(NEWS_FEED_URL, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(8000),
  });
  if (!feedResponse.ok) throw new Error(`Newsletter feed returned ${feedResponse.status}`);

  const newsletter = parseLatestNewsletterFeed(await feedResponse.text());
  if (!newsletter) throw new Error("No newsletter article was found");

  let description: string | null = null;
  let imageUrl: string | null = null;
  try {
    const articleResponse = await fetch(newsletter.url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    });
    if (articleResponse.ok) {
      const html = await articleResponse.text();
      description = metaContent(html, "og:description") || null;
      imageUrl = safeImageUrl(metaContent(html, "og:image"));
    }
  } catch {
    // Feed data is still useful when optional article metadata is unavailable.
  }

  return { ...newsletter, description, imageUrl };
}
