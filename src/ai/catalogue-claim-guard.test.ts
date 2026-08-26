import { describe, expect, it } from "vitest";
import { guardPendingRecommendationCatalogueClaim } from "./catalogue-claim-guard";

describe("guardPendingRecommendationCatalogueClaim", () => {
  it("blocks a false whole-catalogue absence claim while gathering cat details", () => {
    const guarded = guardPendingRecommendationCatalogueClaim(
      "I don't currently have any cat food products available in my catalogue to recommend directly.",
      "cat",
      true,
    );

    expect(guarded).not.toContain("don't currently have any cat food");
    expect(guarded).toContain("still need to narrow down");
  });

  it("does not alter ordinary guidance", () => {
    const content = "What age and weight is your cat?";
    expect(guardPendingRecommendationCatalogueClaim(content, "cat", true)).toBe(content);
  });
});
