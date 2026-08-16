import "server-only";
import { GoogleGenAI } from "@google/genai";
import { serverConfig } from "@/config/env";
import type { ChatMessage, KnowledgeEntry, ProductRecommendation } from "@/types";
import { buildGroundedInstructions } from "./system-prompt";
import { createLocalResponse, type AssistantResult } from "./local-responder";

export async function answerCustomer(
  messages: ChatMessage[],
  knowledge: KnowledgeEntry[],
  recommendations: ProductRecommendation[]
): Promise<AssistantResult> {
  if (!serverConfig.geminiApiKey) {
    return createLocalResponse(messages, knowledge, recommendations);
  }

  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  const conversation = firstUserIndex >= 0 ? messages.slice(firstUserIndex) : messages;
  const gemini = new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
  const response = await gemini.models.generateContent({
    model: serverConfig.geminiModel,
    contents: conversation.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    })),
    config: {
      systemInstruction: buildGroundedInstructions(knowledge, recommendations.map(({ product }) => product)),
      temperature: 0.35,
      maxOutputTokens: 900
    }
  });

  return {
    content: response.text || "I'm sorry, I couldn't form a response just now. Please try again.",
    recommendations,
    mode: "gemini"
  };
}
