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

  it("keeps a simple opening-hours question concise", async () => {
    const hoursKnowledge = {
      ...knowledge,
      content: "The retail store is at 12 Mill Lane. Regular staffed shop hours are Monday to Friday, 8:30 am to 5:00 pm, and Saturday, 9:00 am to 2:00 pm. The dog wash is available 24/7.",
    };
    const result = await answerCustomer([{ ...message, content: "What time do you open?" }], [hoursKnowledge], []);

    expect(result.content).toBe("Our staffed shop hours are Monday–Friday, 8:30 am to 5:00 pm; Saturday, 9:00 am to 2:00 pm.");
  });
});
