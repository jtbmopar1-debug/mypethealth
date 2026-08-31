import { describe, expect, it } from "vitest";
import type { KnowledgeEntry } from "@/types";
import { primaryKnowledgeProductControls } from "./primary-knowledge";

function entry(overrides: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: "entry",
    title: "Question",
    category: "general",
    summary: "Summary",
    content: "Approved answer",
    followUpQuestions: [],
    safetyNotes: [],
    tags: [],
    relevantProductTags: [],
    recommendedProductUrls: [],
    enabled: true,
    approvedExact: true,
    ...overrides,
  };
}

describe("primaryKnowledgeProductControls", () => {
  it("never borrows product links from a secondary knowledge result", () => {
    const controls = primaryKnowledgeProductControls([
      entry({ id: "transition", recommendedProductUrls: [] }),
      entry({ id: "pancreatitis", recommendedProductUrls: ["https://allgoodpetfood.co.nz/products/pancreacare"] }),
    ]);

    expect(controls.entry?.id).toBe("transition");
    expect(controls.productUrls).toEqual([]);
  });

  it("uses only links and tags explicitly saved on the primary entry", () => {
    const controls = primaryKnowledgeProductControls([
      entry({
        id: "skin",
        relevantProductTags: ["skin-support"],
        recommendedProductUrls: ["https://allgoodpetfood.co.nz/products/skin-balm"],
      }),
    ]);

    expect(controls.productTags).toEqual(["skin-support"]);
    expect(controls.productUrls).toEqual(["https://allgoodpetfood.co.nz/products/skin-balm"]);
  });
});
