import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  serverConfig: { geminiApiKey: undefined, geminiModel: "test", geminiFallbackModel: undefined },
}));

import { answerCustomer } from "./assistant-service";
import type { ChatMessage, KnowledgeEntry } from "@/types";

const message: ChatMessage = {
  id: "question",
  role: "user",
  content: "What should I do?",
  createdAt: new Date(0).toISOString(),
};

const knowledge: KnowledgeEntry = {
  id: "approved-answer",
  title: "Approved question",
  category: "general",
  summary: "A shorter admin summary that must not be shown.",
  content: "This is the exact staff-approved customer answer.",
  followUpQuestions: ["This must not be appended."],
  safetyNotes: [],
  tags: [],
  relevantProductTags: [],
  enabled: true,
  approvedExact: true,
};

describe("approved knowledge responses", () => {
  it("returns the approved answer verbatim instead of a summary or model rewrite", async () => {
    const result = await answerCustomer([message], [knowledge], []);

    expect(result).toMatchObject({
      content: "This is the exact staff-approved customer answer.",
      mode: "approved-knowledge",
    });
  });

  it("does not expose a built-in grounding entry as staff-approved verbatim copy", async () => {
    const result = await answerCustomer([message], [{ ...knowledge, approvedExact: false }], []);

    expect(result.mode).not.toBe("approved-knowledge");
  });
});
