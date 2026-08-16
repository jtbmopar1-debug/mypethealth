import type { ChatMessage, KnowledgeEntry, ProductRecommendation } from "@/types";

export interface AssistantResult {
  content: string;
  recommendations: ProductRecommendation[];
  mode: "openai" | "local-demo";
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
  recommendations: ProductRecommendation[]
): AssistantResult {
  const latest = messages.at(-1)?.content.toLowerCase() ?? "";
  const conversationTopic = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ")
    .toLowerCase();
  const enoughContext = detailsPresent(messages);
  const safeRecommendations = enoughContext ? recommendations : [];

  if (/itch|scratch|skin|coat|allerg/.test(conversationTopic)) {
    if (!enoughContext) {
      return {
        content: "Itching can have a few causes — food is one possibility, but environmental allergies, parasites and skin conditions can look similar. I can help you think through the food side without assuming it’s an allergy.\n\nWhat food and main protein is your dog eating now, and how long has the itching been going on? It would also help to know their age, approximate weight, and whether there are other symptoms such as sore skin, ear trouble or digestive changes.",
        recommendations: [],
        mode: "local-demo"
      };
    }
    return {
      content: "Thanks — that gives me a clearer picture. A consistent trial using a different, clearly identified protein may be a reasonable food step, although it can’t confirm an allergy on its own. Avoid changing treats and several other foods at the same time, or it becomes hard to tell what helped.\n\nBased on the details you’ve shared, the options below are the closest catalogue matches. If the itching is severe, causing broken skin, or keeps going, it’s worth checking in with your vet as well.",
      recommendations: safeRecommendations,
      mode: "local-demo"
    };
  }

  if (/stomach|stool|poo|diarr|digest|vomit|gas/.test(conversationTopic)) {
    if (!enoughContext) {
      return {
        content: "A sensitive stomach can be influenced by the main food, treats, sudden changes and things picked up outside. What is your dog eating now, when did the change start, and have there been any new treats or table food?\n\nAlso, is there vomiting, blood, marked tiredness or weight loss? Those signs deserve prompt veterinary advice rather than a food trial alone.",
        recommendations: [],
        mode: "local-demo"
      };
    }
    return {
      content: "A simple recipe and a slow change can be a sensible next step. Transition over roughly 7–10 days — longer if your dog is especially sensitive — and keep other treats and extras consistent while you watch stool quality.\n\nThese are the closest available matches from the catalogue. Persistent diarrhoea, repeated vomiting, blood or lethargy should be checked by a vet.",
      recommendations: safeRecommendations,
      mode: "local-demo"
    };
  }

  if (/transition|switch|change.*food/.test(latest)) {
    return {
      content: "A gradual change over about 7–10 days suits many dogs: start near 25% new food, move to half-and-half, then 75% new food before changing over fully. If stools soften, pause at the current step or slow the transition.\n\nKeep portions measured and avoid adding several new treats at the same time. Does your dog normally handle food changes well, and what are you transitioning from?",
      recommendations: [],
      mode: "local-demo"
    };
  }

  if (/how much|feed|portion|grams|cups/.test(latest)) {
    return {
      content: "The feeding guide for the exact product is the best starting point, then the amount should be adjusted for your dog rather than treated as a fixed prescription. What do they weigh, how old and active are they, and are you aiming to maintain, gain or lose weight?\n\nOnce I know the product too, I can help interpret its guide. Recheck body condition and weight after two to four weeks, remembering that treats count towards the day’s intake.",
      recommendations: [],
      mode: "local-demo"
    };
  }

  const followUps = knowledge[0]?.followUpQuestions.slice(0, 2).join(" ");
  return {
    content: knowledge.length
      ? `I can help with that. ${knowledge[0].summary}\n\n${followUps || "Tell me a little more about your dog and what you’re hoping to improve."}`
      : "I don’t have enough My Pet Health information to answer that confidently yet. Tell me a little about your dog — their age, approximate weight, current food and what you’d like help with — and I’ll narrow it down.",
    recommendations: [],
    mode: "local-demo"
  };
}
