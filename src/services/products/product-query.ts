import { containsProductSearchAlias } from "./product-search-aliases";

const stopWords = new Set([
  "a", "an", "and", "any", "are", "about", "again", "at", "available", "better", "bigger", "can", "carry", "catalog", "catalogue", "come",
  "back", "be", "check", "choose", "could", "current", "currently", "deal", "deals", "discount", "discounted", "do", "find", "for",
  "does", "get", "going", "got", "guy", "guys", "have", "help", "i", "in", "is", "it", "larger", "live", "looking", "me", "moment", "need", "now",
  "of", "on", "or", "please", "product", "products", "recommend", "sale", "sales", "sell", "show", "some", "special", "this", "that", "these", "those", "them",
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
    .flatMap((term) => {
      // Customers commonly join a product descriptor and category while the
      // catalogue title separates them, such as "pigears" or "bullysticks".
      const compound = term.match(/^(.{2,}?)(ears|sticks|treats|chews|bites|snacks)$/);
      if (compound) {
        const category = compound[2].endsWith("s") ? compound[2].slice(0, -1) : compound[2];
        return [compound[1], category];
      }
      return term.length > 3 && term.endsWith("s") && !term.endsWith("ss") ? term.slice(0, -1) : term;
    });
}

export function wantsProductSuggestion(message: string) {
  const text = message.toLowerCase();
  if (/\b(?:itchy|itching|bleeding|vomiting|hurts?|pain|swollen)\b/i.test(text)
    && !/\b(?:buy|sell|stock|recommend|looking for|product)\b/i.test(text)) return false;
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
  if (/\b(?:come in|available in|larger|smaller|bag|bags|pack|packs|variant|flavou?r)\b/i.test(text)
    && productSearchAnchors(productSearchTerms(message)).length > 0) return true;
  if (/\b(?:what|which)\s+sizes?\b/i.test(text)
    && productSearchAnchors(productSearchTerms(message)).length > 0) return true;

  // A named food follow-up, such as "dry dog food salmon bleu", must search
  // the live catalogue instead of being treated as a general knowledge query.
  const terms = productSearchTerms(message);
  if (/\b(?:dog|cat)\s+(?:food|kibble)\b/i.test(text)
    && productSearchAnchors(terms).some((term) => !["dry", "wet"].includes(term))) return true;

  // Current availability is an operational catalogue request regardless of
  // product wording (for example, "bully sticks in stock?").
  if (wantsProductStockStatus(message)) return true;

  // A bare category phrase is a catalogue shorthand. Merely mentioning that
  // category inside a health or feeding question is not shopping intent.
  const categoryPhrase = /\b(?:raw\s+food|treats?|chews?|ears?|toys?|collars?|leads?|harness(?:es)?|bowls?|supplements?|litter|grooming|flea|worm)\b/i;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount <= 5 && categoryPhrase.test(text)) return true;

  return /\b(?:suggest|recommend|better|alternative)\b[\w\s]{0,30}\b(?:food|diet|option|product|brand)\b/i.test(text)
    || /\b(?:food|diet|option|product|brand)\b[\w\s]{0,30}\b(?:suggest|recommend|better|alternative)\b/i.test(text)
    || /\b(?:do you(?: guys)? (?:do|sell|stock|carry)|have you got|got any)\b/i.test(text);
}

export function wantsProductVariantDetails(message: string) {
  return /\b(?:size|sizes|sized|bag|bags|pack|packs|variant|variants|flavou?r|flavou?rs)\b/i.test(message);
}

export function wantsNamedProductFacts(message: string) {
  return /\b(?:flavou?r|ingredients?|grain[- ]?free|wheat[- ]?free|hypoallergenic|kibble size|suitable for|safe for)\b/i.test(message);
}

export function namedProductIdentityTerms(message: string) {
  if (!wantsNamedProductFacts(message)) return [];

  // In questions such as "what flavour is the Pancrea Care? Is it grain-free?",
  // only the first clause names the product. The remaining clauses describe
  // facts to answer and must not become mandatory catalogue identifiers.
  const clauses = message.split(/[?!.]+/).map((clause) => clause.trim()).filter(Boolean);
  for (const clause of clauses) {
    const match = clause.match(/\b(?:what|which)\s+(?:flavou?rs?|ingredients?|recipe)\s+(?:is|are|does)\s+(?:the\s+)?(.+?)(?=\s+and\s+(?:is|are|does|can|will|would)\b|$)/i);
    if (match) return productSearchAnchors(productSearchTerms(match[1]));

    const subjectMatch = clause.match(/^(.+?)\s+(?:is|are|does)\s+(?:it\s+)?(?:grain[- ]?free|wheat[- ]?free|hypoallergenic|suitable for|safe for)\b/i);
    if (subjectMatch) return productSearchAnchors(productSearchTerms(subjectMatch[1]));
  }
  return [];
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function closestDistinctiveProductTitle(identityTerms: string[], titles: string[]) {
  const requested = identityTerms.join("").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (requested.length < 7) return null;

  const ranked = titles.map((title) => {
    const words = title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const candidates = [...words, words.join("")].filter((candidate) => candidate.length >= 7);
    return { title, distance: Math.min(...candidates.map((candidate) => editDistance(requested, candidate))) };
  }).sort((left, right) => left.distance - right.distance);

  const best = ranked[0];
  const maximumDistance = Math.max(1, Math.floor(requested.length / 6));
  if (!best || best.distance > maximumDistance || ranked[1]?.distance === best.distance) return null;
  return best.title;
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
    && /(?:is this the product you mean|did you mean .+)\?/i.test(previousAssistantMessage);
}

export function rejectsProductIdentity(message: string, previousAssistantMessage = "") {
  return /^(?:no|nope|nah|not that|wrong (?:one|product)|that(?:'s| is) not it)\b/i.test(message.trim())
    && /(?:is this the product you mean|did you mean .+)\?/i.test(previousAssistantMessage);
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
