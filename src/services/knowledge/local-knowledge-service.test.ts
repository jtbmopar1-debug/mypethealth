import { describe, expect, it } from "vitest";
import { LocalKnowledgeService, rankKnowledge, scoreKnowledge } from "./local-knowledge-service";
import type { KnowledgeEntry } from "@/types";

const entry: KnowledgeEntry = {
  id: "itchy",
  title: "Itchy dogs",
  category: "skin-and-coat",
  summary: "Dietary considerations for itching",
  content: "Ask about current protein and other symptoms.",
  followUpQuestions: [],
  safetyNotes: [],
  tags: ["itching", "protein"],
  relevantProductTags: [],
  enabled: true
};

describe("local knowledge retrieval", () => {
  it("weights matching tags more strongly than body text", () => {
    expect(scoreKnowledge(entry, "itching")).toBeGreaterThan(scoreKnowledge(entry, "current"));
  });

  it("finds digestive knowledge without returning every entry", async () => {
    const results = await new LocalKnowledgeService().search("My dog has a sensitive stomach", 3);
    expect(results[0]?.category).toBe("digestive-issues");
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("matches a skin-product question to skin knowledge rather than puppy feeding", async () => {
    const results = await new LocalKnowledgeService().search("do you have any products for dog skin rash?", 2);

    expect(results[0]?.id).toBe("itchy-dogs-first-steps");
    expect(results.some((result) => result.id === "puppy-feeding")).toBe(false);
  });

  it("explains the online store product background colours", async () => {
    const results = await new LocalKnowledgeService().search("What do pink and green products mean?", 3);

    expect(results[0]?.id).toBe("online-store-colour-coding");
    expect(results[0]?.content).toContain("pink background");
    expect(results[0]?.content).toContain("green background");
  });

  it("does not retrieve grain guidance from generic issue wording", () => {
    const grainEntry: KnowledgeEntry = {
      ...entry,
      id: "grain-guidance",
      title: "Is grain-free better than wheat-free?",
      summary: "Guidance for grain, wheat and yeast issues",
      content: "Most dogs are fine on wheat-free food.",
      tags: ["grain-free", "wheat-free", "yeast issues"],
    };

    expect(rankKnowledge([grainEntry], "Are these known to cause any issues with dogs?", 2)).toEqual([]);
  });
});
