import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { serverConfig } from "@/config/env";
import type { ChatMessage, KnowledgeEntry, ProductRecommendation } from "@/types";
import { buildGroundedInstructions } from "./system-prompt";
import { createLocalResponse, type AssistantResult } from "./local-responder";

function candidateFinishReason(response: GenerateContentResponse) {
  return response.candidates?.[0]?.finishReason;
}

function needsContinuation(content: string) {
  const trimmed = content.trim();
  if (!trimmed || /[.!?…:]$/.test(trimmed)) return false;
  return /(?:\b(?:from|with|and|or|but|because|that|to|for|of|in|on|if|when|as|the|a|an|i|we|they|it))$/i.test(trimmed);
}

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
      maxOutputTokens: 1600
    }
  });

  let content = response.text || "";
  if ((candidateFinishReason(response) === "MAX_TOKENS" || needsContinuation(content)) && content) {
    const continuation = await gemini.models.generateContent({
      model: serverConfig.geminiModel,
      contents: [
        ...conversation.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        })),
        { role: "model", parts: [{ text: content }] },
        { role: "user", parts: [{ text: "Continue exactly from where you stopped. Do not repeat the earlier text. Keep the same tone and finish the answer naturally." }] }
      ],
      config: {
        systemInstruction: buildGroundedInstructions(knowledge, recommendations.map(({ product }) => product)),
        temperature: 0.25,
        maxOutputTokens: 900
      }
    });
    const continuationText = continuation.text || "";
    if (continuationText) content = content.replace(/\s+$/, "") + " " + continuationText.trim();
  }

  return {
    content: content || "I'm sorry, I couldn't form a response just now. Please try again.",
    recommendations,
    mode: "gemini"
  };
}
