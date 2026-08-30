import type { ChatMessage, KnowledgeEntry, ProductRecommendation } from "@/types";

export interface AssistantResult {
  content: string;
  recommendations: ProductRecommendation[];
  mode: "gemini" | "local-demo" | "pet-profile" | "approved-knowledge";
}

function detailsPresent(messages: ChatMessage[]) {
  const userText = messages.filter((message) => message.role === "user").map((message) => message.content).join(" ").toLowerCase();
  const facts = [
    /\b\d+(?:\.\d+)?\s*(?:kg|kilo|years?|months?|yo)\b/,
    /(?:eats?|eating|food|fed|protein|chicken|beef|lamb|salmon|turkey)/,
    /(?:week|month|day|since|started|tried|changed)/
  ];
  return messages.filter((message) => message.role === "user").length >= 2 || facts.filter((pattern) => pattern.test(userText)).length >= 2;
}

export function createLocalResponse(
  messages: ChatMessage[],
  knowledge: KnowledgeEntry[],
  recommendations: ProductRecommendation[],
  options: {
    specialsRequested?: boolean;
    matchingSpecialsFound?: boolean;
    regularAlternativesForSpecials?: boolean;
    stockStatusRequested?: boolean;
    productClarificationRequired?: boolean;
    stockEnquiryAvailable?: boolean;
  } = {}
): AssistantResult {
  const latest = messages.at(-1)?.content.toLowerCase() ?? "";
  const conversationTopic = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ")
    .toLowerCase();
  const enoughContext = detailsPresent(messages);
  const safeRecommendations = enoughContext ? recommendations : [];

  if (options.productClarificationRequired) {
    const examples = recommendations.slice(0, 4).map(({ product }) => product.title).join(", ");
    return {
      content: `I found several possible catalogue matches${examples ? `, including ${examples}` : ""}. Which exact type do you mean—for example raw food, dog or cat food, or chews/treats—and which size or variant? Once that’s clear I can check the correct item’s current stock and price.`,
      recommendations: [],
      mode: "local-demo",
    };
  }

  if (options.stockStatusRequested) {
    const match = recommendations[0]?.product;
    if (!match) {
      return {
        content: "I couldn’t verify that exact product in the current catalogue, so I can’t give you a reliable restock date or future special price.",
        recommendations: [],
        mode: "local-demo",
      };
    }
    return {
      content: match.availability === "in_stock"
        ? "That item is currently in stock at the price shown below. The catalogue doesn’t include future promotion plans, so I can’t confirm whether it will be on special later."
        : `That item is currently out of stock. The catalogue doesn’t include a restock date or future promotion plans, so I can’t reliably promise when it will return or whether it will be on special. Would you like me to check closely related options that are currently in stock?${options.stockEnquiryAvailable ? "\n\nWould you like me to email All Good Petfood about this out-of-stock product?" : ""}`,
      recommendations,
      mode: "local-demo",
    };
  }

  if (options.specialsRequested) {
    if (options.matchingSpecialsFound && recommendations.length > 0) {
      return {
        content: "Yes — matching current specials are shown below.",
        recommendations,
        mode: "local-demo",
      };
    }
    if (options.regularAlternativesForSpecials && recommendations.length > 0) {
      return {
        content: "There aren’t any matching specials at the moment, but we do have matching in-stock products at their regular prices, shown below.",
        recommendations,
        mode: "local-demo",
      };
    }
    return {
      content: "There aren’t any matching specials or in-stock regular alternatives in the catalogue at the moment.",
      recommendations: [],
      mode: "local-demo",
    };
  }

  if (/itch|scratch|skin|coat|allerg/.test(conversationTopic)) {
    if (!enoughContext) {
      return {
        content: "Itching can have a few causes — food is one possibility, but environmental allergies, parasites and skin conditions can look similar. I can help you think through the food side without assuming it’s an allergy.\n\nWhat food and main protein is your pet eating now, and how long has the itching been going on? It would also help to know their age, approximate weight, and whether there are other symptoms such as sore skin, ear trouble or digestive changes.",
        recommendations: [],
        mode: "local-demo"
      };
    }
    return {
      content: "Thanks — that gives me a clearer picture. A consistent trial using a different, clearly identified protein may be a reasonable food step, although it can’t confirm an allergy on its own. Avoid changing treats and several other foods at the same time, or it becomes hard to tell what helped.\n\nBased on the details you’ve shared, the options below are the closest catalogue matches. If the itching is severe, causing broken skin, or keeps going, the All Good team can help and will recommend or refer to a vet if they consider it necessary.",
      recommendations: safeRecommendations,
      mode: "local-demo"
    };
  }

  if (/stomach|stool|poo|diarr|digest|vomit|gas/.test(conversationTopic)) {
    if (!enoughContext) {
      return {
        content: "A sensitive stomach can be influenced by the main food, treats, sudden changes and things picked up outside. What is your pet eating now, when did the change start, and have there been any new treats or table food?\n\nAlso, is there vomiting, blood, marked tiredness or weight loss? The All Good team can help and will recommend or refer to a vet if they consider it necessary.",
        recommendations: [],
        mode: "local-demo"
      };
    }
    return {
      content: "A simple recipe and a slow change can be a sensible next step. Transition over roughly 7–10 days — longer if your pet is especially sensitive — and keep other treats and extras consistent while you watch stool quality.\n\nThese are the closest available matches from the catalogue. For persistent diarrhoea, repeated vomiting, blood or lethargy, the All Good team can help and will recommend or refer to a vet if they consider it necessary.",
      recommendations: safeRecommendations,
      mode: "local-demo"
    };
  }

  if (/transition|switch|change.*food/.test(latest)) {
    return {
      content: "A gradual change over about 7–10 days suits many pets: start near 25% new food, move to half-and-half, then 75% new food before changing over fully. If stools soften, pause at the current step or slow the transition.\n\nKeep portions measured and avoid adding several new treats at the same time. Does your pet normally handle food changes well, and what are you transitioning from?",
      recommendations: [],
      mode: "local-demo"
    };
  }

  if (/how much|feed|portion|grams|cups/.test(latest)) {
    return {
      content: "The feeding guide for the exact product is the best starting point, then the amount should be adjusted for your pet rather than treated as a fixed prescription. What do they weigh, how old and active are they, and are you aiming to maintain, gain or lose weight?\n\nOnce I know the product too, I can help interpret its guide. Recheck body condition and weight after two to four weeks, remembering that treats count towards the day’s intake.",
      recommendations: [],
      mode: "local-demo"
    };
  }

  const followUps = knowledge[0]?.followUpQuestions.slice(0, 2).join(" ");
  return {
    content: knowledge.length
      ? `I can help with that. ${knowledge[0].summary}\n\n${followUps || "Tell me a little more about your pet and what you’re hoping to improve."}`
      : "I don’t have enough My Pet Health information to answer that confidently yet. Tell me a little about your pet — their age, approximate weight, current food and what you’d like help with — and I’ll narrow it down.",
    recommendations: [],
    mode: "local-demo"
  };
}
