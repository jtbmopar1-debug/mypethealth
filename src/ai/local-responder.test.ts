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
  it("answers named product facts without copying catalogue marketing", () => {
    const product = {
      ...recommendation,
      product: {
        ...recommendation.product,
        title: "Natura PancreaCare",
        description: "Our NATURA PancreaCare is amazing! It is hypoallergenic and will help your dog enjoy life to the fullest!",
        ingredients: ["Fish meal", "Rice", "Vitamins and minerals"],
        tags: ["dog food", "adult", "all breeds", "wheat-free", "red-meat-free"],
      },
    };
    const result = createLocalResponse(
      [user("What flavour is Pancrea Care? Is it grain-free and suitable for small breeds?")],
      [],
      [product],
      { namedProductFactsRequested: true },
    );

    expect(result.content).toContain("fish-based recipe");
    expect(result.content).toContain("does not name a specific flavour");
    expect(result.content).toContain("labelled wheat-free");
    expect(result.content).toContain("not the same as confirmed grain-free");
    expect(result.content).toContain("Yes, it is labelled for adult dogs of all breeds");
    expect(result.content).toContain("suitable for an adult small-breed dog");
    expect(result.content).not.toContain("amazing");
    expect(result.content).not.toContain("enjoy life");
    expect(result.content).not.toContain("â");
  });

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
    expect(result.content).toContain("All Good team can help and will recommend or refer to a vet if they consider it necessary.");
  });
});
