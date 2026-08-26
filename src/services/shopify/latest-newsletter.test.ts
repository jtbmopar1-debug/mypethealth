import { describe, expect, it } from "vitest";
import { parseLatestNewsletterFeed } from "./latest-newsletter";

describe("parseLatestNewsletterFeed", () => {
  it("selects the newest newsletter rather than an unrelated article", () => {
    const feed = `
      <feed>
        <entry><id>https://allgoodpetfood.co.nz/blogs/news/store-update</id><published>2026-08-20T10:00:00+12:00</published><title>Store update</title></entry>
        <entry><id>https://allgoodpetfood.co.nz/blogs/news/august-2026-newsletter</id><published>2026-08-01T10:00:00+12:00</published><link rel="alternate" href="https://allgoodpetfood.co.nz/blogs/news/august-2026-newsletter" /><title><![CDATA[August 2026 Newsletter &amp; Specials]]></title></entry>
      </feed>`;

    expect(parseLatestNewsletterFeed(feed)).toEqual({
      title: "August 2026 Newsletter & Specials",
      url: "https://allgoodpetfood.co.nz/blogs/news/august-2026-newsletter",
      publishedAt: "2026-07-31T22:00:00.000Z",
    });
  });

  it("rejects newsletter links outside the store", () => {
    const feed = `<feed><entry><id>https://example.com/newsletter</id><published>2026-08-01</published><title>Newsletter</title></entry></feed>`;
    expect(parseLatestNewsletterFeed(feed)).toBeNull();
  });
});
