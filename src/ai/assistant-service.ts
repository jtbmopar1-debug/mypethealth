import "server-only";
import OpenAI from "openai";
import { serverConfig } from "@/config/env";
import type { ChatMessage, KnowledgeEntry, ProductRecommendation } from "@/types";
import { buildGroundedInstructions } from "./system-prompt";
import { createLocalResponse, type AssistantResult } from "./local-responder";

export async function answerCustomer(
  messages: ChatMessage[],
  knowledge: KnowledgeEntry[],
  recommendations: ProductRecommendation[]
): Promise<AssistantResult> {
  if (!serverConfig.openAiApiKey) {
    return createLocalResponse(messages, knowledge, recommendations);
  }

  const openai = new OpenAI({ apiKey: serverConfig.openAiApiKey });
  const response = await openai.responses.create({
    model: serverConfig.openAiModel,
    instructions: buildGroundedInstructions(knowledge, recommendations.map(({ product }) => product)),
    input: messages.map((message) => ({
      role: message.role,
      content: message.content
    }))
  });

  return {
    content: response.output_text || "I’m sorry, I couldn’t form a response just now. Please try again.",
    recommendations: recommendations,
    mode: "openai"
  };
}
