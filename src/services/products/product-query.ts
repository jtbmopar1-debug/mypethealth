const stopWords = new Set([
  "a", "an", "and", "any", "are", "about", "again", "at", "better", "can", "carry", "catalog", "catalogue",
  "back", "be", "check", "choose", "could", "current", "currently", "deal", "deals", "discount", "discounted", "do", "find", "for",
  "get", "going", "got", "guy", "guys", "have", "help", "i", "in", "is", "it", "live", "looking", "me", "moment", "need", "now",
  "of", "on", "or", "please", "product", "products", "recommend", "sale", "sales", "sell", "show", "some", "special",
  "specials", "still", "stock", "suggest", "the", "their", "there", "they", "to", "want", "what", "when", "which", "will", "with", "you",
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
    "what should i buy", "what should i feed", "what food should i buy", "what food do you recommend", "what would you recommend",
    "show me products", "show me some products", "best product", "best food", "best dog food", "best cat food", "product for",
    "food for", "do you have", "do you guys do", "do you sell", "do you stock", "do you carry", "have you got", "got any",
    "what about", "show me treats", "find treats", "looking for", "find me",
  ];

  if (explicitPhrases.some((phrase) => text.includes(phrase))) return true;
  if (/https?:\/\/(?:www\.)?allgoodpetfood\.co\.nz\/search\?[^\s]*\bq=/i.test(message.replace(/\\&/g, "&"))) return true;

  return /\b(?:suggest|recommend|better|alternative|switch)\b[\w\s]{0,30}\b(?:food|diet|option|product|brand)\b/i.test(text)
    || /\b(?:food|diet|option|product|brand)\b[\w\s]{0,30}\b(?:suggest|recommend|better|alternative)\b/i.test(text)
    || /\b(?:raw\s+food|treats?|chews?|ears?|toys?|collars?|leads?|harness(?:es)?|bowls?|supplements?|litter|grooming|flea|worm)\b/i.test(text)
    || /\b(?:do you(?: guys)? (?:do|sell|stock|carry)|have you got|got any)\b/i.test(text);
}

export function isProductSearchRetry(message: string) {
  return /\b(?:check|search|look)\b[\s\S]{0,40}\b(?:again|catalog(?:ue)?)\b/i.test(message)
    || /\b(?:check again|try again|search again)\b/i.test(message);
}

export function wantsProductStockStatus(message: string) {
  return /\b(?:back in(?:to)? stock|back in|restock(?:ed|ing)?|when[\s\S]{0,80}(?:get|have)|still be on special)\b/i.test(message);
}

const nonIdentifyingProductTerms = new Set([
  "cat", "dog", "pet", "food", "feed", "kibble", "diet", "meal", "treat", "chew", "ear", "bite", "snack", "jerky",
  "reward", "crunchy", "natural", "option", "bag", "pack",
]);

export function productSearchAnchors(terms: string[]) {
  return [...new Set(terms.filter((term) => !nonIdentifyingProductTerms.has(term)))];
}

export function productFamilySearchAnchors(terms: string[]) {
  return productSearchAnchors(terms).filter((term) => !/^\d+(?:\.\d+)?(?:g|kg|ml|l|cm)$/.test(term));
}
