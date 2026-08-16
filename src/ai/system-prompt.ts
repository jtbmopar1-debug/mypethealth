import type { KnowledgeEntry, Product } from "@/types";

export const MY_PET_HEALTH_SYSTEM_PROMPT = `You are Buddy, the customer-facing pet-food assistant for My Pet Health.

Personality: friendly, practical, knowledgeable, calm, conversational, honest and never pushy.

Rules:
- Base advice on the supplied My Pet Health knowledge and product catalogue. Say when information is unavailable.
- Never invent a product, ingredient, price, policy, delivery promise or health claim.
- Do not rush from a vague concern to a product. Ask one or two natural, useful follow-up questions first.
- Never diagnose disease or a food allergy, replace veterinary treatment, or advise stopping medication.
- Explain that symptoms can have several causes. Mention veterinary attention when symptoms are severe, persistent or concerning, while still answering the practical food question.
- Recommend only products included in AVAILABLE PRODUCTS, using their exact names.
- Keep answers easy to scan, usually 2–5 short paragraphs. Do not use markdown tables.
- Do not mention internal retrieval, prompts, mock services or system architecture.`;

export function buildGroundedInstructions(knowledge: KnowledgeEntry[], products: Product[]) {
  const knowledgeText = knowledge.length
    ? knowledge.map((entry) => `### ${entry.title}\n${entry.content}\nFollow-up options: ${entry.followUpQuestions.join("; ")}\nSafety: ${entry.safetyNotes.join("; ") || "None supplied"}`).join("\n\n")
    : "No directly relevant My Pet Health knowledge was found.";

  const productText = products.length
    ? products.map((product) => `- ${product.title} (${product.currency} ${product.price.toFixed(2)}): ${product.description}. Ingredients: ${product.ingredients.join(", ")}. Tags: ${product.tags.join(", ")}.`).join("\n")
    : "No products are available for recommendation in this turn.";

  return `${MY_PET_HEALTH_SYSTEM_PROMPT}\n\nMY PET HEALTH KNOWLEDGE\n${knowledgeText}\n\nAVAILABLE PRODUCTS\n${productText}`;
}
