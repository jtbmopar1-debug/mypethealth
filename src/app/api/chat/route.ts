import { z } from "zod";
import type { NextRequest } from "next/server";
import { answerCustomer } from "@/ai/assistant-service";
import { getLatestRestockEnquiry, restockEnquiryConfigured, sendRestockEnquiry } from "@/services/enquiries/restock-enquiry-service";
import { knowledgeService } from "@/services/knowledge/supabase-knowledge-service";
import { ShopifyProductService } from "@/services/products/shopify-product-service";
import { productMatchesSpecies } from "@/services/products/product-relevance";
import {
  isProductSearchRetry,
  confirmsRestockEnquiry,
  productFamilySearchAnchors,
  productSearchAnchors,
  productSearchTerms,
  wantsProductStockStatus,
  wantsProductSuggestion,
  wantsProductAlternatives,
  wantsRestockEnquiryStatus,
} from "@/services/products/product-query";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";
import { fetchRecentCustomerPurchases } from "@/services/shopify/customer-orders";
import { rememberCustomerPets } from "@/services/pets/customer-pet-service";

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
  createdAt: z.string(),
  productIds: z.array(z.string()).optional()
});

const bodySchema = z.object({ messages: z.array(messageSchema).min(1).max(40) });

function confirmsPetProfile(message: string, previousAssistantMessage = "") {
  const affirmative = /^(?:yes|yes please|yep|yeah|sure|okay|ok|please do|go ahead|add (?:him|her|them|it)|please add (?:him|her|them|it))\b/i.test(message.trim());
  return affirmative && /(?:add|save|remember).{0,120}(?:profile|my pets)/i.test(previousAssistantMessage);
}

function wantsSpecials(message: string) {
  if (/\b(?:specials|on\s+special|sale|discounted?|deals?)\b/i.test(message)) return true;
  return /\b(?:this\s+week(?:'s|’s)?\s+specials?|weekly\s+specials?|sale\s+items?|special\s+offers?)\b/i.test(message);
}

function isBroadCategoryQuestion(message: string) {
  return /\b(?:raw\s+food|dog\s+food|cat\s+food|pet\s+food|treats?|chews?|toys?|collars?|leads?|harness(?:es)?|bowls?|supplements?|cat\s+litter|grooming|flea\s+(?:products?|treatments?)|worming)\b/i.test(message)
    && /\b(?:do you(?: guys)? (?:do|sell|stock|carry|have)|have you got|got any|what .* do you have)\b/i.test(message);
}

function isShortCategoryRefinement(message: string) {
  const terms = productSearchTerms(message);
  return terms.length > 0 && terms.length <= 4
    && /\b(?:any|with|without|lamb|beef|chicken|turkey|venison|fish|salmon|tuna|pork|rabbit|grain|raw|freeze[- ]?dried|dry|wet)\b/i.test(message);
}

function hasRecommendationContext(message: string) {
  const hasSpecies = /\b(?:dog|puppy|pup|cat|kitten)\b/i.test(message);
  const hasLifeStage = /\b\d+(?:\.\d+)?\s*(?:weeks?|months?|years?|yo)\b/i.test(message)
    || /\b(?:puppy|pup|kitten|adult|senior)\b/i.test(message);
  const hasSize = /\b\d+(?:\.\d+)?\s*(?:kg|kilos?)\b/i.test(message)
    || /\b(?:small|medium|large|giant)\b/i.test(message);
  const hasSensitivityContext = /\b(?:sensitive|allerg|intoleran|dietary|condition|no (?:issues?|allergies|sensitivities)|none)\b/i.test(message);
  return hasSpecies && hasLifeStage && hasSize && hasSensitivityContext;
}

function needsHealthKnowledge(message: string) {
  return /\b(?:itch|yeast|allerg|sensitive|stomach|diarrh|vomit|skin|coat|weight|underweight|overweight|feed(?:ing)?|portion|diet|nutrition|health|condition|symptom|puppy|kitten|senior|transition)\b/i.test(message);
}

function explicitlyWantsPurchaseHistory(message: string) {
  return /\b(?:order history|purchase history|previous(?:ly)? (?:bought|ordered)|last (?:bought|ordered|purchase|order)|bought last|ordered last|usual (?:food|order|product)|reorder|re-order|buy (?:it|that|them) again|what did i (?:buy|order))\b/i.test(message);
}

function reportsHealthChange(message: string) {
  return /\b(?:itch(?:y|ing)?|scratch(?:ing)?|lick(?:ing)?|rash|redness|skin|coat|hair loss|yeast|ear (?:issue|infection|irritation)|cough(?:ing)?|sneez(?:e|ing)|wheez(?:e|ing)|breath(?:ing)?|vomit(?:ing)?|diarrh(?:ea|eal)|loose stools?|constipat(?:ed|ion)|gas|appetite|weight (?:loss|gain)|losing weight|gaining weight|letharg(?:y|ic)|tired|limp(?:ing)?|urinary|urinat(?:e|ing|ion)|drinking more|thirst(?:y)?|unwell|sick|symptoms?)\b/i.test(message);
}

function purchaseHistoryCouldAnswer(message: string) {
  return explicitlyWantsPurchaseHistory(message)
    || reportsHealthChange(message)
    || /\b(?:how much|feeding amount|portion|daily amount)\b[\s\S]{0,60}\b(?:feed|food|give|eat)\b/i.test(message)
    || /\b(?:feed|give)\b[\s\S]{0,40}\bhow much\b/i.test(message);
}

function wantsPurchasedProductCards(message: string) {
  return /\b(?:reorder|re-order|buy (?:it|that|them) again|usual (?:food|order|product)|what did i (?:buy|order)|last (?:bought|ordered))\b/i.test(message);
}

function purchasesRelevantToQuestion<T extends { title: string; productType: string | null }>(message: string, purchases: T[]) {
  if (explicitlyWantsPurchaseHistory(message)) {
    return [...purchases].sort((left, right) => {
      const isFood = (purchase: T) => /\b(?:food|feed|diet|kibble|raw|meal|puppy|kitten)\b/i.test(`${purchase.title} ${purchase.productType || ""}`);
      return Number(isFood(right)) - Number(isFood(left));
    }).slice(0, 10);
  }

  const asksAboutPuppy = /\b(?:puppy|pup)\b/i.test(message);
  const asksAboutKitten = /\bkitten\b/i.test(message);
  const asksAboutDog = asksAboutPuppy || /\bdog\b/i.test(message);
  const asksAboutCat = asksAboutKitten || /\bcat\b/i.test(message);
  const potentiallyRelevantProducts = purchases.filter((purchase) => {
    const searchable = `${purchase.title} ${purchase.productType || ""}`;
    if (!/\b(?:food|feed|diet|kibble|raw|meal|puppy|kitten|treat|chew|supplement|oil|shampoo|conditioner|balm|salve|spray|skin|coat|flea|worm)\b/i.test(searchable)) return false;
    if (asksAboutDog && /\bcat\b/i.test(searchable) && !/\bdog\b/i.test(searchable)) return false;
    if (asksAboutCat && /\bdog\b/i.test(searchable) && !/\bcat\b/i.test(searchable)) return false;
    return true;
  });

  return potentiallyRelevantProducts.sort((left, right) => {
    const leftText = `${left.title} ${left.productType || ""}`;
    const rightText = `${right.title} ${right.productType || ""}`;
    const leftLifeStageMatch = asksAboutPuppy && /\b(?:puppy|junior)\b/i.test(leftText)
      || asksAboutKitten && /\b(?:kitten|junior)\b/i.test(leftText);
    const rightLifeStageMatch = asksAboutPuppy && /\b(?:puppy|junior)\b/i.test(rightText)
      || asksAboutKitten && /\b(?:kitten|junior)\b/i.test(rightText);
    return Number(rightLifeStageMatch) - Number(leftLifeStageMatch);
  }).slice(0, 5);
}

function mentionedActivePet<T extends { name: string; status: string }>(message: string, pets: T[]) {
  return pets.find((pet) => pet.status === "active"
    && new RegExp(`\\b${pet.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message));
}

export async function POST(request: NextRequest) {
  try {
    const customerSession = readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
    if (!customerSession) {
      return Response.json({ error: "Sign in with All Good Petfood to chat with Buddy." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Please send a valid message." }, { status: 400 });
    }

    const { messages } = parsed.data;
    const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
    const latestUserMessage = userMessages.at(-1) ?? "";
    const conversationQuery = userMessages.join(" ");
    const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    const confirmsProposedPet = confirmsPetProfile(latestUserMessage, previousAssistant?.content);
    const confirmedProposalMessage = confirmsProposedPet ? userMessages.at(-2) : undefined;
    let customerPets: Awaited<ReturnType<typeof rememberCustomerPets>>["pets"] = [];
    let petProfileProposals: string[] = [];
    let savedPetNames: string[] = [];
    let updatedPetNames: string[] = [];
    try {
      const petMemory = await rememberCustomerPets(customerSession.customerId, latestUserMessage, confirmedProposalMessage);
      customerPets = petMemory.pets;
      petProfileProposals = petMemory.proposedPets.map((pet) => pet.name);
      savedPetNames = petMemory.savedPetNames;
      updatedPetNames = petMemory.updatedPetNames;
      console.info("[chat] pet profiles", customerPets.map((pet) => ({ name: pet.name, status: pet.status })));
    } catch (error) {
      console.warn("[chat] pet memory unavailable", error instanceof Error ? error.message : "Unknown error");
    }
    const productService = new ShopifyProductService();
    const previousProductIds = previousAssistant?.productIds ?? [];
    const enquiryContextAssistant = [...messages].reverse().find((message) => message.role === "assistant"
      && message.productIds?.length === 1
      && /email All Good Petfood about (?:this|the) out-of-stock product/i.test(message.content));
    const sendEnquiry = confirmsRestockEnquiry(latestUserMessage, enquiryContextAssistant?.content);
    const showAlternatives = wantsProductAlternatives(latestUserMessage);
    const requestedProductIds = enquiryContextAssistant?.productIds ?? previousProductIds;

    if (wantsRestockEnquiryStatus(latestUserMessage)) {
      try {
        const enquiry = await getLatestRestockEnquiry(customerSession.customerId, requestedProductIds[0]);
        const message = !enquiry
          ? "I don’t have a recorded stock enquiry for this account."
          : enquiry.status === "sent" && enquiry.sent_at
            ? `The stock enquiry for ${enquiry.product_title} was sent on ${new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Pacific/Auckland" }).format(new Date(enquiry.sent_at))}.`
            : enquiry.status === "sending"
              ? `The stock enquiry for ${enquiry.product_title} is still being processed and is not yet recorded as sent.`
              : `The attempted stock enquiry for ${enquiry.product_title} was not sent successfully.`;
        return Response.json({ message, products: [], resetProductContext: false, pets: customerPets, mode: "restock-enquiry-status" });
      } catch (error) {
        console.warn("[restock-enquiry] history unavailable", error instanceof Error ? error.message : "Unknown error");
        return Response.json({
          message: "I can’t check the stock-enquiry history right now. Please try again shortly.",
          products: [],
          resetProductContext: false,
          pets: customerPets,
          mode: "restock-enquiry-status",
        });
      }
    }

    if ((sendEnquiry || showAlternatives) && requestedProductIds.length === 1) {
      const requestedProduct = await productService.getProduct(requestedProductIds[0]);
      if (requestedProduct) {
        let enquiryMessage = "";
        if (sendEnquiry) {
          if (requestedProduct.availability === "in_stock") {
            enquiryMessage = "Good news—the product is currently showing as in stock, so I haven’t sent a restock enquiry.";
          } else if (!customerSession.email) {
            enquiryMessage = "I can’t send the enquiry because this signed-in account doesn’t include an email address.";
          } else if (!restockEnquiryConfigured()) {
            enquiryMessage = "I can’t send the enquiry because the store email service isn’t available right now.";
          } else {
            try {
              const sent = await sendRestockEnquiry({
                shopifyCustomerId: customerSession.customerId,
                customerEmail: customerSession.email,
                customerName: [customerSession.firstName, customerSession.lastName].filter(Boolean).join(" "),
                product: requestedProduct,
                question: userMessages.slice(-4, -1).join("\n").slice(0, 4000),
              });
              const sentAt = sent.sentAt ? new Intl.DateTimeFormat("en-NZ", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Pacific/Auckland",
              }).format(new Date(sent.sentAt)) : "earlier today";
              enquiryMessage = sent.alreadySent
                ? `That stock enquiry was already sent on ${sentAt}. Staff can reply directly to your account email.`
                : `Done—I sent the stock enquiry on ${sentAt}. Staff can reply directly to your account email.`;
            } catch (error) {
              console.warn("[restock-enquiry] send failed", error instanceof Error ? error.message : "Unknown error");
              enquiryMessage = error instanceof Error && error.message === "Stock enquiry daily limit reached"
                ? "You’ve reached the stock-enquiry limit for today. Please try again tomorrow or contact All Good Petfood directly."
                : "I couldn’t send the stock enquiry just now. Nothing was falsely marked as sent—please try again shortly.";
            }
          }
        }

        let alternatives = [] as Awaited<ReturnType<ShopifyProductService["recommendProducts"]>>;
        if (showAlternatives) {
          const searchable = `${requestedProduct.title} ${requestedProduct.tags.join(" ")}`.toLowerCase();
          const protein = ["venison", "lamb", "beef", "chicken", "turkey", "salmon", "fish", "pork", "rabbit", "goat", "possum", "kangaroo"]
            .find((term) => searchable.includes(term));
          const categoryTerms = ["raw", "food", "chew", "treat", "dental"].filter((term) => searchable.includes(term));
          alternatives = (await productService.recommendProducts(
            [...new Set([protein, ...categoryTerms].filter((term): term is string => Boolean(term)))],
            5,
            {
              availableOnly: true,
              allowFallback: false,
              requiredTerms: protein ? [protein] : undefined,
              species: /\bcat\b/i.test(searchable) ? "cat" : /\bdog\b/i.test(searchable) ? "dog" : null,
            },
          )).filter(({ product }) => product.id !== requestedProduct.id).slice(0, 3);
        }

        if (!sendEnquiry && requestedProduct.availability === "out_of_stock"
          && customerSession.email && restockEnquiryConfigured()) {
          enquiryMessage = "Would you also like me to email All Good Petfood about this out-of-stock product?";
        }

        if (sendEnquiry || showAlternatives) {
          const alternativesMessage = showAlternatives
            ? alternatives.length > 0
              ? "I’ve also shown the closest related options that are currently in stock."
              : "I couldn’t find a closely related in-stock alternative without broadening the search too far."
            : "Would you also like me to show closely related options that are currently in stock?";
          return Response.json({
            message: [enquiryMessage, alternativesMessage].filter(Boolean).join("\n\n"),
            products: alternatives,
            resetProductContext: false,
            pets: customerPets,
            mode: "restock-enquiry",
          });
        }
      }
    }
    const recentPetContext = userMessages.slice(-3).join(" ");
    const latestNamedPet = mentionedActivePet(latestUserMessage, customerPets);
    const startsNewProductSearch = /\b(?:looking for|do you (?:have|sell|stock|carry)|have you got|show me|find me|recommend|specials|on special|sale)\b/i.test(latestUserMessage);
    const recentNamedPet = [...userMessages].slice(-3).reverse()
      .map((message) => mentionedActivePet(message, customerPets))
      .find((pet) => Boolean(pet));
    const targetPet = latestNamedPet ?? (startsNewProductSearch ? undefined : recentNamedPet);
    const explicitlyRequestedSpecies = /\b(?:cat|kitten|feline)\b/i.test(recentPetContext) ? "cat" as const
      : /\b(?:dog|puppy|pup|canine)\b/i.test(recentPetContext) ? "dog" as const
      : null;
    const targetSpecies = targetPet?.species ?? explicitlyRequestedSpecies;
    const petNameTerms = new Set(customerPets.flatMap((pet) => productSearchTerms(pet.name)));
    const latestHasProductIntent = wantsProductSuggestion(latestUserMessage);
    const earlierProductIntent = userMessages.slice(0, -1).some(wantsProductSuggestion);
    const petProfileOnlyTurn = (petProfileProposals.length > 0 || savedPetNames.length > 0 || updatedPetNames.length > 0)
      && !latestHasProductIntent
      && !needsHealthKnowledge(latestUserMessage);
    const recommendationContextReady = hasRecommendationContext(conversationQuery);
    const latestProductRequest = [...userMessages].reverse()
      .find((message) => wantsProductSuggestion(message) && !isProductSearchRetry(message)) ?? latestUserMessage;
    const broadCategoryQuestion = isBroadCategoryQuestion(latestUserMessage);
    const broadCategoryIndex = userMessages.findLastIndex(isBroadCategoryQuestion);
    const activeBroadCategoryRequest = broadCategoryIndex >= 0;
    const latestDirectTerms = productSearchTerms(latestUserMessage);
    const refiningBroadCategory = !broadCategoryQuestion
      && activeBroadCategoryRequest
      && isShortCategoryRefinement(latestUserMessage);
    const genericBroadContinuation = !broadCategoryQuestion
      && activeBroadCategoryRequest
      && latestHasProductIntent
      && latestDirectTerms.length === 0;
    const stockStatusRequested = wantsProductStockStatus(latestUserMessage);
    const stockStatusIndex = userMessages.findLastIndex(wantsProductStockStatus);
    const continuingProductDefinition = !stockStatusRequested
      && stockStatusIndex >= Math.max(0, userMessages.length - 3)
      && stockStatusIndex < userMessages.length - 1
      && !startsNewProductSearch
      && latestDirectTerms.length > 0
      && latestDirectTerms.length <= 4;
    const effectiveStockStatusRequested = stockStatusRequested || continuingProductDefinition;
    const specialsRequested = wantsSpecials(latestUserMessage) && !stockStatusRequested;
    const catalogueOnlyTurn = (specialsRequested
      || effectiveStockStatusRequested
      || broadCategoryQuestion
      || refiningBroadCategory
      || genericBroadContinuation)
      && !needsHealthKnowledge(latestUserMessage);
    const previousUserMessage = userMessages.at(-2) ?? "";
    const knowledgeQuery = productSearchTerms(latestUserMessage).length <= 4 && previousUserMessage
      ? `${previousUserMessage} ${latestUserMessage}`
      : latestUserMessage;
    const knowledge = catalogueOnlyTurn || petProfileOnlyTurn ? [] : await knowledgeService.search(knowledgeQuery, 2);
    // Include a small amount of recent conversation so a short follow-up such as
    // "it started last week" can still be related to the symptom just discussed.
    const recentPurchaseContext = userMessages.slice(-3).join(" ");
    const purchaseHistoryRelevant = purchaseHistoryCouldAnswer(recentPurchaseContext);
    let recentPurchases = [] as Awaited<ReturnType<typeof fetchRecentCustomerPurchases>>;
    let purchaseHistoryUnavailable = false;
    if (purchaseHistoryRelevant && customerSession.accessToken) {
      try {
        recentPurchases = await fetchRecentCustomerPurchases(customerSession.accessToken);
      } catch (error) {
        purchaseHistoryUnavailable = true;
        console.warn("[chat] purchase history unavailable", error instanceof Error ? error.message : "Unknown error");
      }
    }
    const relevantPurchases = purchasesRelevantToQuestion(recentPurchaseContext, recentPurchases);
    const retryingProductSearch = earlierProductIntent && isProductSearchRetry(latestUserMessage);
    const continuingSelection = (!latestHasProductIntent || retryingProductSearch)
      && earlierProductIntent
      && (previousProductIds.length <= 1 || activeBroadCategoryRequest)
      && (recommendationContextReady || refiningBroadCategory || retryingProductSearch);
    const specialSearchTerms = [
      ...productSearchTerms(latestUserMessage).filter((term) => !petNameTerms.has(term)),
      ...(targetSpecies ? [targetSpecies] : []),
    ];
    let recommendations = specialsRequested
      ? await productService.getSpecials(6, specialSearchTerms)
      : [];
    const matchingSpecialsFound = specialsRequested && recommendations.length > 0;
    let regularAlternativesForSpecials = false;

    if (specialsRequested && recommendations.length === 0 && specialSearchTerms.length > 0) {
      recommendations = (await productService.recommendProducts([
        specialSearchTerms.join(" "),
        ...specialSearchTerms,
      ], 3, {
        availableOnly: true,
        allowFallback: false,
        species: targetSpecies,
      })).map((recommendation) => ({
        ...recommendation,
        reason: "A matching in-stock option at its current regular price; it is not on special.",
      }));
      regularAlternativesForSpecials = recommendations.length > 0;
    }

    if (!specialsRequested && (latestHasProductIntent || continuingSelection || continuingProductDefinition)) {
      const broadCategoryMessages = broadCategoryIndex >= 0
        ? userMessages.slice(broadCategoryIndex).filter((message, index) => index === 0 || isShortCategoryRefinement(message))
        : [];
      const broadCategorySearch = broadCategoryMessages.length > 0 ? broadCategoryMessages.join(" ") : latestProductRequest;
      const useBroadCategorySearch = broadCategoryQuestion
        || refiningBroadCategory
        || genericBroadContinuation
        || (activeBroadCategoryRequest && continuingSelection);
      const statusRequest = stockStatusIndex >= 0 ? userMessages[stockStatusIndex] : "";
      const searchSource = continuingProductDefinition
        ? `${statusRequest} ${latestUserMessage}`
        : retryingProductSearch
        ? latestProductRequest
        : useBroadCategorySearch
        ? broadCategorySearch
        : latestHasProductIntent ? latestUserMessage : latestProductRequest;
      const directTerms = productSearchTerms(searchSource).filter((term) => !petNameTerms.has(term));
      const directAnchorTerms = productSearchAnchors(directTerms);
      const statusRequiredTerms = effectiveStockStatusRequested
        ? [...new Set([
          ...productFamilySearchAnchors(productSearchTerms(statusRequest || latestUserMessage)),
          ...(continuingProductDefinition ? latestDirectTerms : []),
        ])]
        : [];
      if (targetSpecies && !directTerms.includes(targetSpecies)) directTerms.push(targetSpecies);
      const categoryRequiredTerms = useBroadCategorySearch
        ? [...new Set(broadCategoryMessages.flatMap(productSearchTerms).filter((term) => term !== "food"))]
        : [];
      const discoveryOnly = broadCategoryQuestion;
      const limit = effectiveStockStatusRequested ? 12
        : discoveryOnly ? 6
        : refiningBroadCategory || genericBroadContinuation || recommendationContextReady ? 3 : 1;
      recommendations = await productService.recommendProducts(directTerms.length > 0
        ? [directTerms.join(" "), ...directTerms]
        : [...new Set(knowledge.flatMap((entry) => entry.relevantProductTags))], limit, {
          includeTreatAddon: recommendationContextReady,
          availableOnly: !discoveryOnly && !effectiveStockStatusRequested,
          // Specific searches must never degrade into an unrelated card just
          // because no exact product scored above zero.
          allowFallback: directTerms.length === 0 && !discoveryOnly && !targetSpecies,
          requiredTerms: categoryRequiredTerms.length > 0
            ? categoryRequiredTerms
            : statusRequiredTerms.length > 0 ? statusRequiredTerms
            : directAnchorTerms.length > 0 ? directAnchorTerms : undefined,
          species: targetSpecies,
        });

      const linkedUrls = [...new Set(knowledge.flatMap((entry) => entry.recommendedProductUrls ?? []))];
      if (linkedUrls.length > 0 && !discoveryOnly) {
        const linkedRecommendations = (await Promise.all(linkedUrls.slice(0, 6).map((url) => productService.getProductByUrl(url))))
          .filter((product): product is NonNullable<typeof product> => product !== null)
          .filter((product) => product.availability === "in_stock")
          .filter((product) => productMatchesSpecies(product, targetSpecies))
          .map((product) => ({ product, reason: "Staff-reviewed product linked to this guidance." }));
        recommendations = [
          ...linkedRecommendations,
          ...recommendations.filter(({ product }) => !linkedRecommendations.some((linked) => linked.product.id === product.id)),
        ].slice(0, limit);
      }
    }

    const referencedProducts = !latestHasProductIntent && !activeBroadCategoryRequest && previousProductIds.length > 0
      ? (await Promise.all(previousProductIds.slice(0, 6).map((productId) => productService.getProduct(productId))))
        .filter((product) => product !== null)
        .map((product) => ({ product, reason: "Product discussed earlier in this conversation." }))
      : [];
    const recentProductIds = [...new Set(relevantPurchases.map((purchase) => purchase.productId).filter((id): id is string => Boolean(id)))];
    const purchasesByProductId = new Map(relevantPurchases
      .filter((purchase) => purchase.productId)
      .map((purchase) => [purchase.productId as string, purchase]));
    const purchasedProducts = (await Promise.all(recentProductIds.slice(0, 6).map(async (productId) => {
      const purchase = purchasesByProductId.get(productId);
      const product = await productService.getPurchasedProduct(productId, purchase?.variantId ?? null, purchase?.variantTitle ?? null);
      return product ? { product, purchase } : null;
    })))
      .filter((item) => item !== null)
      .map(({ product, purchase }) => {
        const oldPrice = purchase?.unitPrice;
        const difference = oldPrice === null || oldPrice === undefined ? null : product.price - oldPrice;
        const priceNote = difference === null
          ? "The earlier purchase price was unavailable for comparison."
          : Math.abs(difference) < 0.005
            ? "Current price matches the recorded purchase price."
            : `Current price is $${Math.abs(difference).toFixed(2)} ${difference > 0 ? "higher" : "lower"} than the recorded purchase price.`;
        return {
          product,
          reason: product.availability === "in_stock"
            ? "The exact item and variant from this customer's recent purchase history."
            : "This previously purchased variant is currently out of stock.",
          priceNote,
        };
      });
    const groundingRecommendations = recommendations.length > 0
      ? recommendations
      : referencedProducts.length > 0
        ? referencedProducts
        : purchasedProducts;
    const discoveryOnly = broadCategoryQuestion;
    const productClarificationRequired = effectiveStockStatusRequested && recommendations.length > 1;
    const selectionNeedsVetting = (refiningBroadCategory || genericBroadContinuation) && !recommendationContextReady;
    const purchaseHistoryDisplayed = wantsPurchasedProductCards(latestUserMessage) && purchasedProducts.length > 0;
    const displayRecommendations = purchaseHistoryDisplayed
      ? purchasedProducts.slice(0, 3)
      : productClarificationRequired
      ? []
      : discoveryOnly
      ? []
      : continuingSelection
      ? recommendations.filter(({ product }) => !previousProductIds.includes(product.id))
      : recommendations;

    console.info("[chat] user message", { length: latestUserMessage.length });
    console.info("[chat] knowledge retrieved", knowledge.map((entry) => entry.id));
    console.info("[chat] products retrieved", recommendations.map(({ product }) => product.id));

    const result = await answerCustomer(messages, knowledge, groundingRecommendations, {
      productsDisplayed: displayRecommendations.length > 0,
      discoveryOnly,
      selectionNeedsVetting,
      specialsRequested,
      matchingSpecialsFound,
      regularAlternativesForSpecials,
      stockStatusRequested: effectiveStockStatusRequested,
      productClarificationRequired,
      stockEnquiryAvailable: restockEnquiryConfigured() && Boolean(customerSession.email),
      recentPurchases: recentPurchases.slice(0, 10),
      primaryPurchaseTitles: relevantPurchases.map((purchase) => purchase.title),
      purchaseHistoryDisplayed,
      purchaseHistoryUnavailable: explicitlyWantsPurchaseHistory(latestUserMessage)
        && (purchaseHistoryUnavailable || !customerSession.accessToken),
      customerPets,
      petProfileProposals,
      savedPetNames,
      updatedPetNames,
      petProfileOnlyTurn,
    });
    console.info("[chat] assistant response", { mode: result.mode, length: result.content.length });

    return Response.json({
      message: result.content,
      products: displayRecommendations,
      resetProductContext: discoveryOnly,
      pets: customerPets,
      mode: result.mode
    });
  } catch (error) {
    console.error("[chat] error", error instanceof Error ? { name: error.name, message: error.message } : "Unknown error");
    return Response.json({
      error: "The assistant is having trouble responding. Please try again.",
      ...(process.env.NODE_ENV === "development" && error instanceof Error ? { detail: error.message } : {}),
    }, { status: 500 });
  }
}
