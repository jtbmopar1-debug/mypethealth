import { describe, expect, it } from "vitest";
import { formatConversationTranscript } from "./contact-transcript";

describe("formatConversationTranscript", () => {
  it("includes every message and displayed product", () => {
    const transcript = formatConversationTranscript({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Venison question",
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:01:00.000Z",
      messages: [
        { id: "22222222-2222-4222-8222-222222222222", role: "user", content: "When is it back?", createdAt: "2026-08-26T00:00:00.000Z" },
        {
          id: "33333333-3333-4333-8333-333333333333",
          role: "assistant",
          content: "I cannot confirm the date.",
          createdAt: "2026-08-26T00:01:00.000Z",
          products: [{
            reason: "",
            product: {
              id: "gid://shopify/Product/1", title: "Venison Treats", description: "", ingredients: [], price: 20,
              currency: "NZD", image: "https://example.com/image.png", url: "https://allgoodpetfood.co.nz/products/venison",
              retailer: "All Good Petfood", tags: [], availability: "out_of_stock",
            },
          }],
        },
      ],
    });

    expect(transcript).toContain("Customer\nWhen is it back?");
    expect(transcript).toContain("Buddy\nI cannot confirm the date.");
    expect(transcript).toContain("Product shown: Venison Treats");
    expect(transcript).toContain("https://allgoodpetfood.co.nz/products/venison");
  });
});
