import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { serverConfig } from "@/config/env";
import type { ChatMessage, CustomerPet, CustomerPurchase, KnowledgeEntry, ProductRecommendation } from "@/types";
import { buildGroundedInstructions } from "./system-prompt";
import { createLocalResponse, type AssistantResult } from "./local-responder";

function candidateFinishReason(response: GenerateContentResponse) {
  return response.candidates?.[0]?.finishReason;
}

function needsContinuation(content: string) {
  const trimmed = content.trim();
  return Boolean(trimmed) && !/[.!?…:]$/.test(trimmed);
}

export async function answerCustomer(
  messages: ChatMessage[],
  knowledge: KnowledgeEntry[],
  recommendations: ProductRecommendation[],
  options: {
    productsDisplayed?: boolean;
    discoveryOnly?: boolean;
    selectionNeedsVetting?: boolean;
    recentPurchases?: CustomerPurchase[];
    primaryPurchaseTitles?: string[];
    purchaseHistoryDisplayed?: boolean;
    purchaseHistoryUnavailable?: boolean;
    customerPets?: CustomerPet[];
    petProfileProposals?: string[];
    savedPetNames?: string[];
    updatedPetNames?: string[];
    petProfileOnlyTurn?: boolean;
  } = {}
): Promise<AssistantResult> {
  if (options.petProfileOnlyTurn && options.petProfileProposals?.length) {
    const names = options.petProfileProposals.join(" and ");
    return {
      content: `It’s lovely to meet ${names}. Tell me their age, breed or size, and any dietary or health needs whenever you’re ready.\n\nShall I add ${names} to My Pets? This helps me remember their details between conversations and make future guidance and product suggestions more relevant.`,
      recommendations: [],
      mode: "pet-profile",
    };
  }

  if (options.petProfileOnlyTurn && options.savedPetNames?.length) {
    const names = options.savedPetNames.join(" and ");
    const savedPets = (options.customerPets ?? []).filter((pet) => options.savedPetNames?.includes(pet.name));
    const missing = new Set<string>();
    for (const pet of savedPets) {
      if (!pet.breed) missing.add("breed or size");
      if (pet.ageValue === null) missing.add("age");
      if (!pet.currentFoodTitle) missing.add("current food");
      if (pet.knownSensitivities.length === 0) missing.add("dietary sensitivities");
    }
    const followUp = [...missing].slice(0, 3);
    return {
      content: `${names} ${options.savedPetNames.length === 1 ? "is" : "are"} now saved in My Pets.${followUp.length ? ` You can help me complete ${options.savedPetNames.length === 1 ? "the profile" : "their profiles"} by sharing ${followUp.join(", ")} when you’re ready.` : " You can review or update the details from My Pets at any time."}`,
      recommendations: [],
      mode: "pet-profile",
    };
  }

  if (options.petProfileOnlyTurn && options.updatedPetNames?.length) {
    const names = options.updatedPetNames.join(" and ");
    return {
      content: `Thanks for clarifying — I’ve updated ${names}${options.updatedPetNames.length === 1 ? "’s profile" : "’ profiles"} in My Pets.`,
      recommendations: [],
      mode: "pet-profile",
    };
  }

  if (!serverConfig.geminiApiKey) {
    return createLocalResponse(messages, knowledge, recommendations);
  }

  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  const conversation = firstUserIndex >= 0 ? messages.slice(firstUserIndex) : messages;
  const gemini = new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
  const generate = (temperature: number) => gemini.models.generateContent({
    model: serverConfig.geminiModel,
    contents: conversation.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    })),
    config: {
      httpOptions: {
        timeout: 12000,
        retryOptions: { attempts: 2, initialDelay: 0.4, maxDelay: 1, expBase: 1.5, jitter: 0.2 },
      },
      systemInstruction: buildGroundedInstructions(knowledge, recommendations.map(({ product }) => product), options),
      temperature,
      maxOutputTokens: 900
    }
  });

  let response: GenerateContentResponse;
  try {
    response = await generate(0.35);
  } catch (error) {
    console.warn("[chat] model unavailable; using local response", error instanceof Error ? error.message : "Unknown error");
    return createLocalResponse(messages, knowledge, recommendations);
  }

  let content = response.text || "";
  if ((candidateFinishReason(response) === "MAX_TOKENS" || needsContinuation(content)) && content) {
    console.warn("[chat] incomplete model response; regenerating", { finishReason: candidateFinishReason(response), length: content.length });
    try {
      response = await generate(0.2);
      content = response.text || "";
    } catch (error) {
      console.warn("[chat] model regeneration failed; using local response", error instanceof Error ? error.message : "Unknown error");
      return createLocalResponse(messages, knowledge, recommendations);
    }
  }

  if (!content || candidateFinishReason(response) === "MAX_TOKENS" || needsContinuation(content)) {
    console.warn("[chat] rejecting incomplete model response", { finishReason: candidateFinishReason(response), length: content.length });
    return createLocalResponse(messages, knowledge, recommendations);
  }

  return {
    content: content || "I'm sorry, I couldn't form a response just now. Please try again.",
    recommendations,
    mode: "gemini"
  };
}
