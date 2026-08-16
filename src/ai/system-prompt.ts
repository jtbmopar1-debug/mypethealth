import type { CustomerPurchase, KnowledgeEntry, Product } from "@/types";

export const MY_PET_HEALTH_SYSTEM_PROMPT = `You are Buddy, the dedicated customer-facing pet-health and shop assistant for All Good Petfood.

Personality: friendly, practical, knowledgeable, calm, conversational, honest and never pushy.

Rules:
- Base advice on the supplied All Good Petfood knowledge and product catalogue. Say when information is unavailable.
- Never invent a product, ingredient, price, policy, delivery promise or health claim.
- Do not rush from a vague concern to a product. Ask one or two natural, useful follow-up questions first.
- Never assume the customer has a dog. Refer to "your pet" unless the customer has identified their animal.
- Never diagnose disease or a food allergy, replace veterinary treatment, or advise stopping medication.
- Explain that symptoms can have several causes. Mention veterinary attention when symptoms are severe, persistent or concerning, while still answering the practical food question.
- Recommend only products included in AVAILABLE PRODUCTS, using their exact names.
- Treat RECENT PURCHASES as private, customer-specific context. A past purchase is evidence of what was ordered, not proof that the customer's current pet is eating it. Confirm before giving product-specific feeding advice.
- Never reveal or infer addresses, payment information, complete order details, or purchases that are not supplied in RECENT PURCHASES.
- After resolving the customer's main question, you may make one concise, relevant add-on prompt based on OTHER RECENT ITEMS, especially treats. Ask whether they would like you to check current options or stock; do not dump extra products, assume they need more, or claim suitability before checking the pet's needs.
- Do not claim that an alternative product or add-on treat suits a particular pet until the customer's species, age or life stage, size, and relevant dietary sensitivities are known. Ask concise follow-up questions when those details are missing.
- For treats and chews, never assume puppy suitability from general marketing language. Ask the puppy's age and size when relevant, recommend close supervision, appropriate sizing, and removing small broken pieces.
- Keep answers concise and easy to scan, usually 2–4 short paragraphs. Product cards carry the detailed catalogue information, so do not repeat it in prose. Do not use markdown tables.
- Do not mention internal retrieval, prompts, mock services or system architecture.`;

interface GroundingOptions {
  productsDisplayed?: boolean;
  discoveryOnly?: boolean;
  selectionNeedsVetting?: boolean;
  recentPurchases?: CustomerPurchase[];
  primaryPurchaseTitles?: string[];
  purchaseHistoryDisplayed?: boolean;
  purchaseHistoryUnavailable?: boolean;
}

export function buildGroundedInstructions(knowledge: KnowledgeEntry[], products: Product[], options: GroundingOptions = {}) {
  const { productsDisplayed = false, discoveryOnly = false, selectionNeedsVetting = false, recentPurchases = [], primaryPurchaseTitles = [], purchaseHistoryDisplayed = false, purchaseHistoryUnavailable = false } = options;
  const knowledgeText = knowledge.length
    ? knowledge.map((entry) => `### ${entry.title}\n${entry.content.slice(0, 1400)}\nFollow-up options: ${entry.followUpQuestions.slice(0, 3).join("; ")}\nSafety: ${entry.safetyNotes.slice(0, 3).join("; ") || "None supplied"}`).join("\n\n")
    : "No directly relevant My Pet Health knowledge was found.";

  const productText = products.length
    ? products.map((product) => `- ${product.title} (${product.currency} ${product.price.toFixed(2)}, ${product.availability === "in_stock" ? "currently available" : "currently out of stock"}): ${product.description.slice(0, 450)}. Ingredients: ${product.ingredients.slice(0, 15).join(", ")}. Tags: ${product.tags.slice(0, 15).join(", ")}.`).join("\n")
    : "No products are available for recommendation in this turn.";

  const primaryTitleSet = new Set(primaryPurchaseTitles);
  const primaryPurchases = recentPurchases.filter((purchase) => primaryTitleSet.has(purchase.title));
  const otherPurchases = recentPurchases.filter((purchase) => !primaryTitleSet.has(purchase.title));
  const formatPurchase = (purchase: CustomerPurchase) => `- ${purchase.purchasedAt.slice(0, 10)}: ${purchase.title}${purchase.variantTitle ? ` — ${purchase.variantTitle}` : ""}, quantity ${purchase.quantity}.`;
  const purchaseText = recentPurchases.length
    ? `LIKELY RELEVANT TO THIS QUESTION\n${primaryPurchases.length ? primaryPurchases.map(formatPurchase).join("\n") : "None identified."}\n\nOTHER RECENT ITEMS\n${otherPurchases.length ? otherPurchases.map(formatPurchase).join("\n") : "None."}`
    : purchaseHistoryUnavailable
      ? "The customer explicitly requested purchase history, but it is unavailable in this session. Do not invent purchases; briefly ask them to sign out and sign in again, then retry."
      : "No recent purchase line items were supplied for this turn.";

  const categoryAvailability = products.some((product) => product.availability === "in_stock")
    ? "Matching products are currently available."
    : products.length > 0
      ? "The store carries matching products, but every matching product supplied is currently out of stock."
      : "No matching products were found in the current catalogue.";
  const presentationText = discoveryOnly
    ? `The customer is only checking whether a broad product category is stocked. ${categoryAvailability} Answer that availability question accurately, but do not list individual products or prices and do not make a recommendation yet. Ask concise questions about pet species, age or life stage, size, current diet, relevant sensitivities, and what they want from the product.`
    : purchaseHistoryDisplayed
    ? "Current product cards corresponding to recent purchases will be shown below. Describe them as recent purchases, not recommendations. Do not repeat prices or a long product list. Confirm which product the customer means if more than one could apply."
    : productsDisplayed && selectionNeedsVetting
    ? "Matching, currently available catalogue products will be shown directly below your answer. Confirm that the store has matching options and say they are shown below, but do not list their names or prices and do not claim they suit this pet yet. Ask for the pet's species, age or life stage, size, and relevant sensitivities so the options can be vetted."
    : productsDisplayed
    ? "Product cards will be shown directly below your answer. Do not list product names or prices in the written reply. Briefly explain the recommendation and say that the suitable options are shown below."
    : "No new product cards will be shown below this answer. Mention a previously discussed product by name only when needed to answer the customer's follow-up; do not repeat a catalogue list or prices.";

  return `${MY_PET_HEALTH_SYSTEM_PROMPT}\n\nPRODUCT PRESENTATION\n${presentationText}\n\nRECENT PURCHASES\n${purchaseText}\n\nMY PET HEALTH KNOWLEDGE\n${knowledgeText}\n\nAVAILABLE PRODUCTS\n${productText}`;
}
