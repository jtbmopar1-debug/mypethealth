import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { brandFallbackMatches } from "./shopify-product-service";

describe("brand-aware product fallback", () => {
  it("runs the same product terms across catalogue brands and keeps only real matches", () => {
    const products = [
      { brand: "Royal Canin", title: "Mini Adult", description: "Dry dog food", tags: ["food"] },
      { brand: "All Good Petfood", title: "Natura Pizzle Stick", description: "A natural beef chew also known as a bully stick", tags: ["natura", "pizzle", "stick"] },
      { brand: "Another Brand", title: "Skin Salve", description: "Topical paw support", tags: ["skin"] },
    ];
    const matches = brandFallbackMatches(products, ["bully", "stick"]);
    expect(matches.map((product) => product.title)).toEqual(["Natura Pizzle Stick"]);
    expect(matches.map((product) => product.title)).not.toContain("Skin Salve");
  });
});
