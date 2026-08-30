export interface KnowledgePolicyConflict {
  id: "medical-treatment" | "future-stock" | "cart-action" | "customer-privacy" | "unverified-claim";
  reason: string;
  nextStep: string;
}

interface ReviewableKnowledge {
  question: string;
  answer: string;
}

const POLICY_CHECKS: Array<KnowledgePolicyConflict & { pattern: RegExp }> = [
  {
    id: "medical-treatment",
    pattern: /\b(?:diagnos(?:e|ed|is)|prescrib(?:e|ed)|stop|start|change)\b[\s\S]{0,50}\b(?:medication|medicine|treatment)\b|\b(?:your pet|your dog|your cat) (?:has|is suffering from)\b/i,
    reason: "Buddy must not diagnose a condition or direct a customer to start, stop, or change treatment.",
    nextStep: "Rewrite this as practical support and say the All Good team can help and will recommend or refer to a vet if they consider it necessary.",
  },
  {
    id: "future-stock",
    pattern: /\b(?:will|should)\s+(?:be\s+)?(?:back\s+in\s+stock|restock(?:ed)?|on\s+special)|\b(?:restock|back in stock)\s+(?:on|by)\s+\w+|\b(?:guarantee|promise)\b/i,
    reason: "Buddy does not have verified future restock or promotion schedules and must not promise one.",
    nextStep: "State only the current catalogue status, then offer to check closely related in-stock alternatives or email the team when appropriate.",
  },
  {
    id: "cart-action",
    pattern: /\b(?:i(?:'ll| will)?|we(?:'ll| will)?|buddy(?:'ll| will)?)\s+(?:add|put)\b[\s\S]{0,45}\b(?:cart|basket)\b|\b(?:added|put)\b[\s\S]{0,45}\b(?:to your|into your)\s+(?:cart|basket)\b/i,
    reason: "Buddy cannot change a customer’s Shopify cart from chat.",
    nextStep: "Tell the customer they can use the Add to cart button on the product card or visit the store instead.",
  },
  {
    id: "customer-privacy",
    pattern: /\b(?:credit card|card number|bank details|payment information|your address|full order details)\b/i,
    reason: "Buddy must not request, reveal, or infer sensitive customer and order information.",
    nextStep: "Remove the sensitive detail and direct the customer to the appropriate secure account or team channel if it is needed.",
  },
  {
    id: "unverified-claim",
    pattern: /\b(?:cure[sd]?|guaranteed? to (?:fix|treat|stop)|will (?:fix|cure|treat)|proven to cure)\b/i,
    reason: "Buddy must not make unverified product or health outcome claims.",
    nextStep: "Use measured wording about possible support, and avoid guaranteeing an outcome for an individual pet.",
  },
];

export function reviewKnowledgePolicy(entry: ReviewableKnowledge): KnowledgePolicyConflict[] {
  const text = `${entry.question}\n${entry.answer}`;
  return POLICY_CHECKS.filter(({ pattern }) => pattern.test(text))
    .map(({ id, reason, nextStep }) => ({ id, reason, nextStep }));
}
