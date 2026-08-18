import { describe, expect, it } from "vitest";
import { createLocalResponse } from "./local-responder";
import type { ChatMessage, ProductRecommendation } from "@/types";

function user(content: string): ChatMessage {
  return { id: content, role: "user", content, createdAt: new Date(0).toISOString() };
}

const recommendation = {
  product: {
    id: "known-product",
    title: "Known product",
    description: "A catalogue product",
    ingredients: [],
    price: 10,
    currency: "NZD" as const,
    image: "/product.svg",
    url: "#",
    retailer: "Test retailer",
    tags: ["skin-support"],
    availability: "in_stock" as const
  },
  reason: "A known match"
} satisfies ProductRecommendation;

describe("local assistant guardrails", () => {
  it("offers regular alternatives when a requested category has no specials", () => {
    const result = createLocalResponse(
      [user("Do you have any shampoo specials?")],
      [],
      [recommendation],
      { specialsRequested: true, regularAlternativesForSpecials: true },
    );

    expect(result.content).toContain("aren’t any matching specials");
    expect(result.content).toContain("regular prices");
    expect(result.recommendations).toHaveLength(1);
  });

  it("asks follow-up questions instead of recommending from a vague itching message", () => {
    const result = createLocalResponse([user("My dog is itchy")], [], [recommendation]);
    expect(result.content).toContain("What food");
    expect(result.recommendations).toEqual([]);
  });

  it("can return only catalogue recommendations after context is supplied", () => {
    const result = createLocalResponse([
      user("My dog is itchy"),
      user("She is 6 years old, 24 kg, eats chicken and this started a month ago")
    ], [], [recommendation]);
    expect(result.recommendations.map(({ product }) => product.id)).toEqual(["known-product"]);
    expect(result.content.toLowerCase()).toContain("vet");
  });
});
