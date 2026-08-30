import { describe, expect, it } from "vitest";
import { reviewKnowledgePolicy } from "./policy-review";

describe("knowledge policy review", () => {
  it("flags a future-restock promise with a practical next step", () => {
    const conflicts = reviewKnowledgePolicy({
      question: "When will this be back?",
      answer: "It will be back in stock next Friday.",
    });

    expect(conflicts).toContainEqual(expect.objectContaining({
      id: "future-stock",
      nextStep: expect.stringContaining("current catalogue status"),
    }));
  });

  it("flags cart actions but leaves ordinary guidance alone", () => {
    expect(reviewKnowledgePolicy({ question: "Can you add it?", answer: "I have added it to your cart." }))
      .toContainEqual(expect.objectContaining({ id: "cart-action" }));
    expect(reviewKnowledgePolicy({ question: "How do I transition food?", answer: "Make changes gradually and watch stool quality." }))
      .toEqual([]);
  });
});
