import { containsProductSearchAlias } from "./product-search-aliases";

const stopWords = new Set([
  "a", "an", "and", "any", "are", "about", "again", "at", "available", "better", "bigger", "can", "carry", "catalog", "catalogue", "come",
  "back", "be", "check", "choose", "could", "current", "currently", "deal", "deals", "discount", "discounted", "do", "find", "for",
  "does", "get", "going", "got", "guy", "guys", "have", "help", "i", "in", "is", "it", "larger", "live", "looking", "me", "moment", "need", "now",
  "of", "on", "or", "please", "product", "products", "recommend", "sale", "sales", "sell", "show", "some", "special",
  "sized", "sizes", "smaller", "specials", "still", "stock", "suggest", "the", "their", "there", "they", "to", "want", "what", "when", "which", "will", "with", "you",
]);

function replaceShopifySearchUrls(message: string) {
  return message.replace(/https?:\/\/\S+/gi, (value) => {
    try {
      const url = new URL(value.replace(/\\&/g, "&"));
      if (/^(?:www\.)?allgoodpetfood\.co\.nz$/i.test(url.hostname) && url.pathname === "/search") {
        return url.searchParams.get("q") || "";
      }
    } catch {
      // The remaining message is still safe to tokenize normally.
    }
    return " ";
  });
}

export function productSearchTerms(message: string) {
  return replaceShopifySearchUrls(message).toLowerCase().split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !stopWords.has(term))
    .map((term) => term.length > 3 && term.endsWith("s") && !term.endsWith("ss") ? term.slice(0, -1) : term);
}

export function wantsProductSuggestion(message: string) {
  const text = message.toLowerCase();
  const explicitPhrases = [
    "product suggestion", "product recommendations", "recommend a product", "recommend products", "suggest a product",
    "suggest products", "help me choose a product", "help me pick a product", "what product should i", "which product should i",
    "what should i buy", "what should i feed", "what to feed", "unsure what to feed", "not sure what to feed", "what food should i buy", "what food do you recommend", "what would you recommend",
    "show me products", "show me some products", "best product", "best food", "best dog food", "best cat food", "product for",
    "food for", "do you have", "do you guys do", "do you sell", "do you stock", "do you carry", "have you got", "got any",
    "what about", "show me treats", "find treats", "looking for", "find me",
  ];

  if (explicitPhrases.some((phrase) => text.includes(phrase))) return true;
  if (/https?:\/\/(?:www\.)?allgoodpetfood\.co\.nz\/search\?[^\s]*\bq=/i.test(message.replace(/\\&/g, "&"))) return true;

  // Customers often ask a stock/catalogue question about an exact item without
  // using the words "stock" or "recommend" (for example, whether a kibble has
  // a larger bag). These need a live catalogue search, not a general AI reply.
  if (/\b(?:does|do|is|are)\b[\s\S]{0,120}\b(?:come in|available in|larger|smaller|size|sizes|bag|bags|pack|packs|variant|flavou?r)\b/i.test(text)
    && /\b(?:food|kibble|treat|chew|litter|supplement|collar|lead|harness|toy|shampoo|conditioner)\b/i.test(text)) return true;

  // Once the customer supplies a meaningful name alongside a pack-size or
  // flavour question, it is a specific catalogue lookup even if they omit
  // the product category (for example, "What sizes does Salmon Bleu come in?").
  if (/\b(?:come in|available in|larger|smaller|size|sizes|bag|bags|pack|packs|variant|flavou?r)\b/i.test(text)
    && productSearchAnchors(productSearchTerms(message)).length > 0) return true;

  // A named food follow-up, such as "dry dog food salmon bleu", must search
  // the live catalogue instead of being treated as a general knowledge query.
  const terms = productSearchTerms(message);
  if (/\b(?:dog|cat)\s+(?:food|kibble)\b/i.test(text)
    && productSearchAnchors(terms).some((term) => !["dry", "wet"].includes(term))) return true;

  return /\b(?:suggest|recommend|better|alternative|switch)\b[\w\s]{0,30}\b(?:food|diet|option|product|brand)\b/i.test(text)
    || /\b(?:food|diet|option|product|brand)\b[\w\s]{0,30}\b(?:suggest|recommend|better|alternative)\b/i.test(text)
    || /\b(?:raw\s+food|treats?|chews?|ears?|toys?|collars?|leads?|harness(?:es)?|bowls?|supplements?|litter|grooming|flea|worm)\b/i.test(text)
    || /\b(?:do you(?: guys)? (?:do|sell|stock|carry)|have you got|got any)\b/i.test(text);
}

export function wantsProductVariantDetails(message: string) {
  return /\b(?:size|sizes|sized|bag|bags|pack|packs|variant|variants|flavou?r|flavou?rs)\b/i.test(message);
}

export function isGenericProductHelpRequest(message: string) {
  return /^(?:please\s+)?(?:help me (?:choose|pick)(?: a)? product|recommend(?: me)? a product|product recommendations?)\s*[.!?]*$/i.test(message.trim());
}

export function isProductSearchRetry(message: string) {
  return /\b(?:check|search|look)\b[\s\S]{0,40}\b(?:again|catalog(?:ue)?)\b/i.test(message)
    || /\b(?:check again|try again|search again)\b/i.test(message);
}

export function wantsCurrentProductAvailability(message: string) {
  return /\b(?:in stock|available|availability)\b/i.test(message);
}

export function wantsProductStockStatus(message: string) {
  return wantsCurrentProductAvailability(message)
    || /\b(?:back in(?:to)? stock|back in|restock(?:ed|ing)?|when[\s\S]{0,80}(?:get|have)|still be on special)\b/i.test(message);
}

const nonIdentifyingProductTerms = new Set([
  "cat", "dog", "pet", "food", "feed", "kibble", "diet", "meal", "bite", "snack", "jerky",
  "reward", "crunchy", "natural", "option", "bag", "pack",
]);

export function productSearchAnchors(terms: string[]) {
  return [...new Set(terms.filter((term) => !nonIdentifyingProductTerms.has(term)))];
}

export function productFamilySearchAnchors(terms: string[]) {
  return productSearchAnchors(terms).filter((term) => !/^\d+(?:\.\d+)?(?:g|kg|ml|l|cm)$/.test(term));
}

export function productStockSearchAnchors(terms: string[]) {
  const exactAnchors = productSearchAnchors(terms);
  return containsProductSearchAlias(terms) ? exactAnchors : productFamilySearchAnchors(terms);
}

export function confirmsRestockEnquiry(message: string, previousAssistantMessage = "") {
  return /\b(?:yes|yep|yeah|sure|please|email|send|contact|ask them)\b/i.test(message)
    && /email All Good Petfood about (?:this|the) out-of-stock product/i.test(previousAssistantMessage);
}

export function confirmsProductIdentity(message: string, previousAssistantMessage = "") {
  return /^(?:yes|yes please|yep|yeah|correct|that(?:'s| is) (?:it|the one)|exactly)\b/i.test(message.trim())
    && /is this the product you mean\?/i.test(previousAssistantMessage);
}

export function rejectsProductIdentity(message: string, previousAssistantMessage = "") {
  return /^(?:no|nope|nah|not that|wrong (?:one|product)|that(?:'s| is) not it)\b/i.test(message.trim())
    && /is this the product you mean\?/i.test(previousAssistantMessage);
}

export function normalizeShopifyResourceId(id: string | null | undefined) {
  return id?.split("/").at(-1)?.trim() || "";
}

export function wantsProductAlternatives(message: string) {
  return /\b(?:show|find|check|see|what about|yes|please)\b[\s\S]{0,35}\b(?:alternatives?|substitutes?|similar (?:products?|options?))\b/i.test(message)
    || /^(?:alternatives?|substitutes?)\??$/i.test(message.trim());
}

export function wantsRestockEnquiryStatus(message: string) {
  return /\b(?:did you send|was (?:the|my) (?:email|enquiry) sent|when (?:was|did).*(?:email|enquiry)|stock enquiry status|what time.*(?:email|enquiry))\b/i.test(message);
}

export function wantsAddToCart(message: string) {
  return /\b(?:add|put)\b[\s\S]{0,35}\b(?:it|that|this|product|item)\b[\s\S]{0,20}\b(?:cart|basket)\b/i.test(message)
    || /\b(?:add|put)\s+(?:it|that|this)\s+to\s+(?:my|the)\s+(?:cart|basket)\b/i.test(message);
}

export function acknowledgesInStockProduct(message: string) {
  return /\b(?:in stock|available)\b/i.test(message)
    && /\b(?:oh|cool|great|good|nice|awesome|excellent|thanks?|thank you|sweet|perfect)\b/i.test(message);
}
