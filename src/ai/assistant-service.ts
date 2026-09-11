import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import { serverConfig } from "@/config/env";
import type { ChatMessage, CustomerPet, CustomerPurchase, KnowledgeEntry, ProductRecommendation } from "@/types";
import { buildGroundedInstructions } from "./system-prompt";
import { createLocalResponse, type AssistantResult } from "./local-responder";
import { primaryApprovedKnowledge } from "../services/knowledge/primary-knowledge";
import type { TurnContext } from "./turn-context";

function candidateFinishReason(response: GenerateContentResponse) {
  return response.candidates?.[0]?.finishReason;
}



function asksOpeningHours(message: string) {
  return /\b(?:what\s+time\s+(?:do\s+you\s+)?open|opening\s+hours?|shop\s+hours?|when\s+(?:are|do)\s+you\s+open)\b/i.test(message);
}

function conciseOpeningHours(content: string) {
  const match = content.match(/(?:regular\s+(?:staffed\s+)?shop\s+hours\s+are\s+)?monday\s+to\s+friday,?\s*([^.;]+?),?\s*(?:and\s+)?saturday,?\s*([^.;]+)/i);
  if (!match) return null;
  return `Our staffed shop hours are Monday–Friday, ${match[1].trim()}; Saturday, ${match[2].trim()}.`;
}

export async function answerCustomer(
  messages: ChatMessage[],
  knowledge: KnowledgeEntry[],
  recommendations: ProductRecommendation[],
  options: {
    productsDisplayed?: boolean;
    discoveryOnly?: boolean;
    selectionNeedsVetting?: boolean;
    specialsRequested?: boolean;
    matchingSpecialsFound?: boolean;
    regularAlternativesForSpecials?: boolean;
    stockStatusRequested?: boolean;
    productClarificationRequired?: boolean;
    stockEnquiryAvailable?: boolean;
    recentPurchases?: CustomerPurchase[];
    primaryPurchaseTitles?: string[];
    purchaseHistoryDisplayed?: boolean;
    purchaseHistoryUnavailable?: boolean;
    customerPets?: CustomerPet[];
    petProfileProposals?: string[];
    savedPetNames?: string[];
    updatedPetNames?: string[];
    petProfileOnlyTurn?: boolean;
    namedProductFactsRequested?: boolean;
    namedProductFactsQuestion?: string;
    guestMode?: boolean;
    turnContext?: TurnContext;
  } = {}
): Promise<AssistantResult> {
  if (options.petProfileOnlyTurn && !options.turnContext?.answeringQuestion && options.petProfileProposals?.length) {
    const names = options.petProfileProposals.join(" and ");
    return {
      content: `It’s lovely to meet ${names}. Tell me their age, breed or size, and any dietary or health needs whenever you’re ready.\n\nShall I add ${names} to My Pets? This helps me remember their details between conversations and make future guidance and product suggestions more relevant.`,
      recommendations: [],
      mode: "pet-profile",
    };
  }

  if (options.petProfileOnlyTurn && !options.turnContext?.answeringQuestion && options.savedPetNames?.length) {
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

  if (options.petProfileOnlyTurn && !options.turnContext?.answeringQuestion && options.updatedPetNames?.length) {
    const names = options.updatedPetNames.join(" and ");
    return {
      content: `Thanks for clarifying — I’ve updated ${names}${options.updatedPetNames.length === 1 ? "’s profile" : "’ profiles"} in My Pets.`,
      recommendations: [],
      mode: "pet-profile",
    };
  }

  // Published knowledge is staff-approved customer copy. Do not ask the model
  // to paraphrase it: the exact approved answer is the response Buddy gives.
  const approvedKnowledge = options.turnContext?.continuing || options.namedProductFactsRequested ? null : primaryApprovedKnowledge(knowledge);
  if (approvedKnowledge) {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
    const compactHours = asksOpeningHours(latestUserMessage) ? conciseOpeningHours(approvedKnowledge.content) : null;
    return {
      content: compactHours ?? approvedKnowledge.content.trim(),
      recommendations,
      mode: "approved-knowledge",
    };
  }

  if (!serverConfig.geminiApiKey) {
    return createLocalResponse(messages, knowledge, recommendations, options);
  }

  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  const conversation = firstUserIndex >= 0 ? messages.slice(firstUserIndex) : messages;
  const gemini = new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
  const deadline = Date.now() + 25000;
  const generate = (model: string, temperature: number, recovery = false) => gemini.models.generateContent({
    model,
    contents: conversation.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    })),
    config: {
      httpOptions: {
        timeout: Math.max(1, Math.min(12000, deadline - Date.now())),
        retryOptions: { attempts: 1 },
      },
      systemInstruction: buildGroundedInstructions(knowledge, recommendations.map(({ product }) => product), options),
      temperature,
      maxOutputTokens: recovery ? 8192 : 4096
    }
  });

  let response: GenerateContentResponse;
  let activeModel = serverConfig.geminiModel;
  try {
    response = await generate(activeModel, 0.35);
  } catch (error) {
    const fallbackModel = serverConfig.geminiFallbackModel;
    if (!fallbackModel || fallbackModel === activeModel) {
      console.warn("[chat] model unavailable; using local response", error instanceof Error ? error.message : "Unknown error");
      return createLocalResponse(messages, knowledge, recommendations, { ...options, generationUnavailable: true });
    }
    console.warn("[chat] primary model unavailable; trying configured fallback", { primaryModel: activeModel, fallbackModel });
    try {
      activeModel = fallbackModel;
      response = await generate(activeModel, 0.25);
    } catch (fallbackError) {
      console.warn("[chat] fallback model unavailable; using local response", fallbackError instanceof Error ? fallbackError.message : "Unknown error");
      return createLocalResponse(messages, knowledge, recommendations, { ...options, generationUnavailable: true });
    }
  }

  let content = response.text || "";
  if (candidateFinishReason(response) === "MAX_TOKENS") {
    console.warn("[chat] incomplete model response; regenerating", { finishReason: candidateFinishReason(response), length: content.length });
    try {
      const fallbackModel = serverConfig.geminiFallbackModel;
      activeModel = fallbackModel && fallbackModel !== activeModel ? fallbackModel : activeModel;
      response = await generate(activeModel, 0.2, true);
      content = response.text || "";
    } catch (error) {
      console.warn("[chat] model regeneration failed; using local response", error instanceof Error ? error.message : "Unknown error");
      return createLocalResponse(messages, knowledge, recommendations, { ...options, generationUnavailable: true });
    }
  }

  console.info("[chat] generation", { model: activeModel, finishReason: candidateFinishReason(response), usage: response.usageMetadata });
  if (!content.trim() || candidateFinishReason(response) !== "STOP") {
    console.warn("[chat] rejecting incomplete model response", { finishReason: candidateFinishReason(response), length: content.length });
    return createLocalResponse(messages, knowledge, recommendations, { ...options, generationUnavailable: true });
  }

  return {
    content: content || "I'm sorry, I couldn't form a response just now. Please try again.",
    recommendations,
    mode: "gemini"
  };
}
