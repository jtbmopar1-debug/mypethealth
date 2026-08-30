import { z } from "zod";
import type { NextRequest } from "next/server";
import { answerCustomer } from "@/ai/assistant-service";
import { guardPendingRecommendationCatalogueClaim } from "@/ai/catalogue-claim-guard";
import { getLatestRestockEnquiry, restockEnquiryConfigured, sendRestockEnquiry } from "@/services/enquiries/restock-enquiry-service";
import { ContactTeamRateLimitError, contactTeamConfigured, sendContactTeamEnquiry } from "@/services/enquiries/contact-team-service";
import { loadCustomerConversation } from "@/services/conversations/customer-conversation-service";
import { knowledgeService } from "@/services/knowledge/supabase-knowledge-service";
import { ShopifyProductService } from "@/services/products/shopify-product-service";
import { productMatchesSpecies } from "@/services/products/product-relevance";
import { productTextMatchesSearchTerm } from "@/services/products/product-search-aliases";
import {
  isProductSearchRetry,
  isGenericProductHelpRequest,
  confirmsProductIdentity,
  confirmsRestockEnquiry,
  normalizeShopifyResourceId,
  productSearchAnchors,
  productStockSearchAnchors,
  rejectsProductIdentity,
  productSearchTerms,
  wantsProductStockStatus,
  wantsCurrentProductAvailability,
  wantsProductSuggestion,
  wantsProductVariantDetails,
  wantsProductAlternatives,
  wantsRestockEnquiryStatus,
  wantsAddToCart,
  acknowledgesInStockProduct,
} from "@/services/products/product-query";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";
import { fetchRecentCustomerOrders } from "@/services/shopify/customer-orders";
import { rememberCustomerPets } from "@/services/pets/customer-pet-service";
import { contextualNamedPetReply } from "@/services/pets/pet-message-parser";
import type { CustomerOrder, ProductRecommendation } from "@/types";

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(12000),
  createdAt: z.string(),
  productIds: z.array(z.string()).optional()
});

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(messageSchema).min(1).max(40),
});

const TEAM_EMAIL_OFFER = "Would you like me to email our team to get an answer to your enquiry?";

function confirmsTeamEmail(message: string, previousAssistantMessage = "") {
  const affirmative = /^(?:yes|yes please|yep|yeah|sure|okay|ok|please do|go ahead|send it|email them)\b/i.test(message.trim());
  return affirmative && previousAssistantMessage.includes(TEAM_EMAIL_OFFER);
}

function responseNeedsTeamEmailOffer(message: string) {
  return /\b(?:i (?:do not|don['’]t) (?:know|have (?:enough|that) information|have access)|i (?:cannot|can['’]t|could not|couldn['’]t) (?:answer|verify|find|confirm|determine|check)|could not be verified|couldn['’]t be verified|information (?:is|was) unavailable)\b/i.test(message)
    && !message.includes(TEAM_EMAIL_OFFER);
}

function variantDetailsReply(product: { title: string; variants?: Array<{ title: string; availability: "in_stock" | "out_of_stock" }> }) {
  const variants = (product.variants || []).filter((variant) => !/^default title$/i.test(variant.title));
  if (variants.length === 0) return null;
  const inStock = variants.filter((variant) => variant.availability === "in_stock").map((variant) => variant.title);
  const outOfStock = variants.filter((variant) => variant.availability === "out_of_stock").map((variant) => variant.title);
  const format = (items: string[]) => new Intl.ListFormat("en-NZ", { style: "long", type: "conjunction" }).format(items);
  return [
    `${product.title} comes in ${format(variants.map((variant) => variant.title))}.`,
    inStock.length ? `${format(inStock)} ${inStock.length === 1 ? "is" : "are"} currently in stock.` : "None of those variants is currently in stock.",
    outOfStock.length ? `${format(outOfStock)} ${outOfStock.length === 1 ? "is" : "are"} currently out of stock.` : "",
  ].filter(Boolean).join("\n\n");
}

function variantProductCards(recommendations: ProductRecommendation[]) {
  return recommendations.flatMap((recommendation) => {
    const variants = (recommendation.product.variants || []).filter((variant) => !/^default title$/i.test(variant.title));
    if (variants.length === 0) return [recommendation];
    return variants.map((variant) => ({
      ...recommendation,
      product: {
        ...recommendation.product,
        variantId: variant.id,
        title: `${recommendation.product.title} — ${variant.title}`,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        availability: variant.availability,
      },
    }));
  });
}

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

function ambiguousFeedingNumber(message: string, previousAssistantMessage: string) {
  const askedForAgeAndWeight = /\b(?:weigh|weight)\b/i.test(previousAssistantMessage)
    && /\b(?:how old|age)\b/i.test(previousAssistantMessage);
  const containsBareNumber = /(?:^|\s|,)\d+(?:\.\d+)?(?:\s|,|$)/.test(message);
  const identifiesNumber = /\b\d+(?:\.\d+)?\s*(?:kg|kilos?|years?|months?|weeks?|yo)\b/i.test(message);
  return askedForAgeAndWeight && containsBareNumber && !identifiesNumber;
}

function needsHealthKnowledge(message: string) {
  return /\b(?:itch|yeast|allerg|sensitive|stomach|diarrh|vomit|skin|coat|weight|underweight|overweight|feed(?:ing)?|portion|diet|nutrition|health|condition|symptom|puppy|kitten|senior|transition)\b/i.test(message);
}

function requestsTopicalSkinSupport(message: string) {
  return /\b(?:cream|balm|salve|spray|soak|shampoo)\b/i.test(message);
}

function mentionsSkinOrPawConcern(message: string) {
  return /\b(?:paw|paws|skin|itch|itchy|red|redness|rash|irritat(?:ed|ion)|lick(?:ing)?|chew(?:ing)?)\b/i.test(message);
}

function explicitlyWantsPurchaseHistory(message: string) {
  return /\b(?:order history|purchase history|order status|where is my order|recent orders?|previous(?:ly)? (?:bought|ordered)|last (?:bought|ordered|purchase|order)|bought last|ordered last|usual (?:food|order|product)|reorder|re-order|buy (?:it|that|them) again|what did i (?:buy|order)|cancelled order|canceled order)\b/i.test(message);
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
  return /\b(?:reorder|re-order|buy (?:it|that|them) again|usual (?:food|order|product)|what did i (?:buy|order)|last (?:bought|ordered|purchase|order)|recent orders?)\b/i.test(message);
}

function purchasesRelevantToQuestion<T extends { title: string; productType: string | null }>(message: string, purchases: T[]) {
  if (explicitlyWantsPurchaseHistory(message)) {
    // Shopify already returns orders newest-first. Preserve that chronology;
    // sorting food ahead of other items can make an older item look like the
    // customer's latest purchase.
    return purchases.slice(0, 20);
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

function readableOrderStatus(status: string | null) {
  return status ? status.toLowerCase().replaceAll("_", " ") : null;
}

function orderHistoryReply(order: CustomerOrder) {
  const orderDate = new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeZone: "Pacific/Auckland",
  }).format(new Date(order.processedAt));
  const total = order.totalPrice === null
    ? ""
    : `, totalling $${order.totalPrice.toFixed(2)} ${order.currency ?? "NZD"}`;
  const itemSummary = order.lineItems.length
    ? order.lineItems.map((item) => `${item.quantity} × ${item.title}${item.variantTitle ? ` (${item.variantTitle})` : ""}`).join("; ")
    : "No line items were returned for this order.";
  const status = order.cancelledAt
    ? `It was cancelled${order.cancelReason ? ` (${readableOrderStatus(order.cancelReason)})` : ""}. It still belongs in your order history.`
    : [readableOrderStatus(order.financialStatus), readableOrderStatus(order.fulfillmentStatus)]
      .filter(Boolean)
      .join("; ");

  return [
    `Your most recent order was ${order.name}, placed ${orderDate}${total}.`,
    status ? `Status: ${status}.` : "",
    `Items: ${itemSummary}`,
    order.cancelledAt
      ? "If you would like to order those items now, the product cards below show their current catalogue availability."
      : "The product cards below show the current catalogue availability where those items are still listed.",
  ].filter(Boolean).join("\n\n");
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

    const { conversationId, messages } = parsed.data;
    const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
    const latestUserMessage = userMessages.at(-1) ?? "";
    const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (confirmsTeamEmail(latestUserMessage, previousAssistant?.content)) {
      if (!customerSession.email) {
        return Response.json({
          message: "I can’t email the team because this signed-in account does not include an email address.",
          products: [],
          resetProductContext: true,
          mode: "team-email-unavailable",
        });
      }
      if (!contactTeamConfigured()) {
        return Response.json({
          message: "I can’t email the team right now because the store email service is unavailable. Please try again shortly.",
          products: [],
          resetProductContext: true,
          mode: "team-email-unavailable",
        });
      }
      const originalQuestion = [...messages.slice(0, -1)].reverse()
        .find((message) => message.role === "user")?.content ?? "Please help with my enquiry.";
      try {
        const conversation = await loadCustomerConversation(customerSession.customerId, conversationId);
        if (!conversation) throw new Error("Saved conversation not found");
        const sent = await sendContactTeamEnquiry({
          shopifyCustomerId: customerSession.customerId,
          customerEmail: customerSession.email,
          customerName: [customerSession.firstName, customerSession.lastName].filter(Boolean).join(" "),
          customerMessage: originalQuestion,
          conversation,
        });
        return Response.json({
          message: sent.alreadySent
            ? "That enquiry has already been emailed to our team. They can reply directly to your account email."
            : "Done—I emailed our team to get an answer to your enquiry. They can reply directly to your account email.",
          products: [],
          resetProductContext: true,
          mode: "team-email-sent",
        });
      } catch (error) {
        const message = error instanceof ContactTeamRateLimitError
          ? "You have already emailed three enquiries to the team in the last 24 hours."
          : "I couldn’t email the team right now. Please try again shortly.";
        console.warn("[chat] team email failed", error instanceof Error ? error.message : "Unknown error");
        return Response.json({ message, products: [], resetProductContext: true, mode: "team-email-failed" });
      }
    }
    if (previousAssistant && ambiguousFeedingNumber(latestUserMessage, previousAssistant.content)) {
      const number = latestUserMessage.match(/\d+(?:\.\d+)?/)?.[0] ?? "that number";
      return Response.json({
        message: `Just to clarify: does ${number} mean ${number} years old or ${number} kg?`,
        products: [],
        resetProductContext: false,
        mode: "feeding-clarification",
      });
    }
    const contextualPet = contextualNamedPetReply(messages);
    const contextualPetMessage = contextualPet
      ? [
        `My ${contextualPet.species ?? "pet"} is named ${contextualPet.name}.`,
        ...messages.slice(contextualPet.contextStartIndex, contextualPet.messageIndex + 1).reverse()
          .filter((message) => message.role === "user")
          .map((message) => message.content),
      ].join(" ")
      : undefined;
    const latestMessageIsContextualPetName = contextualPet?.messageIndex === messages.length - 1;
    const confirmsProposedPet = confirmsPetProfile(latestUserMessage, previousAssistant?.content);
    const confirmedProposalMessage = confirmsProposedPet
      ? contextualPetMessage ?? userMessages.at(-2)
      : undefined;
    let customerPets: Awaited<ReturnType<typeof rememberCustomerPets>>["pets"] = [];
    let petProfileProposals: string[] = [];
    let savedPetNames: string[] = [];
    let updatedPetNames: string[] = [];
    try {
      const petMemory = await rememberCustomerPets(
        customerSession.customerId,
        latestMessageIsContextualPetName && contextualPetMessage ? contextualPetMessage : latestUserMessage,
        confirmedProposalMessage,
      );
      customerPets = petMemory.pets;
      petProfileProposals = petMemory.proposedPets.map((pet) => pet.name);
      savedPetNames = petMemory.savedPetNames;
      updatedPetNames = petMemory.updatedPetNames;
      console.info("[chat] pet profiles", customerPets.map((pet) => ({ name: pet.name, status: pet.status })));
    } catch (error) {
      console.warn("[chat] pet memory unavailable", error instanceof Error ? error.message : "Unknown error");
    }
    if (isGenericProductHelpRequest(latestUserMessage)) {
      const activePetNames = customerPets.filter((pet) => pet.status === "active").map((pet) => pet.name);
      const petChoice = activePetNames.length === 0
        ? "a dog, cat, or another pet"
        : activePetNames.length === 1
          ? `${activePetNames[0]} or another pet`
          : `${activePetNames.slice(0, -1).join(", ")}, ${activePetNames.at(-1)}, or another pet`;
      return Response.json({
        message: `Which pet are we shopping for—${petChoice}? And are you looking for everyday food, treats, or something else?`,
        products: [],
        resetProductContext: true,
        pets: customerPets,
        mode: "product-needs-clarification",
      });
    }
    const productService = new ShopifyProductService();
    const previousProductIds = previousAssistant?.productIds ?? [];
    const confirmedProductIdentity = confirmsProductIdentity(latestUserMessage, previousAssistant?.content);
    const rejectedProductIdentity = rejectsProductIdentity(latestUserMessage, previousAssistant?.content);
    const enquiryContextAssistant = previousAssistant?.productIds?.length === 1
      && /email All Good Petfood about (?:this|the) out-of-stock product/i.test(previousAssistant.content)
      ? previousAssistant
      : undefined;
    const sendEnquiry = confirmsRestockEnquiry(latestUserMessage, enquiryContextAssistant?.content);
    const showAlternatives = wantsProductAlternatives(latestUserMessage);
    const requestedProductIds = enquiryContextAssistant?.productIds ?? previousProductIds;
    const rejectedProductIds = new Set(messages.flatMap((message, index) => {
      if (message.role !== "assistant" || !message.productIds?.length) return [];
      const reply = messages[index + 1];
      return reply?.role === "user" && rejectsProductIdentity(reply.content, message.content)
        ? message.productIds.map(normalizeShopifyResourceId)
        : [];
    }));

    if (confirmedProductIdentity && previousProductIds.length === 1) {
      const confirmedProduct = await productService.getProduct(previousProductIds[0]);
      if (confirmedProduct) {
        const originalStockQuestion = [...userMessages].reverse().find(wantsProductStockStatus) ?? "";
        const askedAboutSpecial = wantsSpecials(originalStockQuestion);
        const currentlyOnSpecial = Boolean(confirmedProduct.compareAtPrice && confirmedProduct.compareAtPrice > confirmedProduct.price)
          || /\b(?:sale|special|discount)\b/i.test(`${confirmedProduct.title} ${confirmedProduct.tags.join(" ")}`);
        const availabilityMessage = confirmedProduct.availability === "in_stock"
          ? `${confirmedProduct.title} is currently showing as in stock.`
          : `${confirmedProduct.title} is currently out of stock, and the catalogue does not provide a future restock date.`;
        const specialMessage = askedAboutSpecial
          ? currentlyOnSpecial
            ? "It is currently listed on special, but I can’t confirm whether that price will still apply later."
            : "It is not currently marked as a special, and I can’t confirm future promotion plans."
          : "";
        const nextSteps = confirmedProduct.availability === "out_of_stock"
          ? `Would you like me to check closely related in-stock alternatives?${customerSession.email && restockEnquiryConfigured() ? "\n\nWould you like me to email All Good Petfood about this out-of-stock product?" : ""}`
          : "";
        return Response.json({
          message: [availabilityMessage, specialMessage, nextSteps].filter(Boolean).join("\n\n"),
          products: [{ product: confirmedProduct, reason: "" }],
          resetProductContext: false,
          pets: customerPets,
          mode: "product-confirmed",
        });
      }
    }

    const previousAssistantConfirmedInStock = /currently showing as in stock/i.test(previousAssistant?.content ?? "");
    if (previousProductIds.length === 1 && wantsAddToCart(latestUserMessage)) {
      return Response.json({
        message: "You can simply click the Add to cart button above to purchase online, or pop into the All Good Petfood store.",
        products: [],
        resetProductContext: false,
        pets: customerPets,
        mode: "cart-guidance",
      });
    }
    if (previousProductIds.length === 1 && previousAssistantConfirmedInStock
      && acknowledgesInStockProduct(latestUserMessage)) {
      return Response.json({
        message: "Great—it’s currently showing as in stock. You can simply click the Add to cart button above to purchase online, or pop into the All Good Petfood store.",
        products: [],
        resetProductContext: false,
        pets: customerPets,
        mode: "stock-acknowledgement",
      });
    }

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
    const speciesContext = startsNewProductSearch ? latestUserMessage : recentPetContext;
    const explicitlyRequestedSpecies = /\b(?:cat|kitten|feline)\b/i.test(speciesContext) ? "cat" as const
      : /\b(?:dog|puppy|pup|canine)\b/i.test(speciesContext) ? "dog" as const
      : null;
    const targetSpecies = targetPet?.species ?? explicitlyRequestedSpecies;
    const petNameTerms = new Set(customerPets.flatMap((pet) => productSearchTerms(pet.name)));
    const latestHasProductIntent = wantsProductSuggestion(latestUserMessage);
    const previousUserMessage = userMessages.at(-2) ?? "";
    const earlierProductIntent = Boolean(previousAssistant?.productIds?.length)
      && wantsProductSuggestion(previousUserMessage);
    const petProfileOnlyTurn = (petProfileProposals.length > 0 || savedPetNames.length > 0 || updatedPetNames.length > 0)
      && !latestHasProductIntent
      && !needsHealthKnowledge(latestUserMessage)
      && !latestMessageIsContextualPetName;
    const recommendationContextReady = hasRecommendationContext(userMessages.slice(-3).join(" "));
    const latestProductRequest = [...userMessages.slice(-3)].reverse()
      .find((message) => wantsProductSuggestion(message) && !isProductSearchRetry(message)) ?? latestUserMessage;
    const broadCategoryQuestion = isBroadCategoryQuestion(latestUserMessage);
    const recentProductMessages = userMessages.slice(-3);
    const recentBroadCategoryIndex = recentProductMessages.findLastIndex(isBroadCategoryQuestion);
    const broadCategoryIndex = recentBroadCategoryIndex < 0
      ? -1
      : userMessages.length - recentProductMessages.length + recentBroadCategoryIndex;
    const activeBroadCategoryRequest = broadCategoryIndex >= 0
      && userMessages.slice(broadCategoryIndex + 1, -1).every((message) => isShortCategoryRefinement(message));
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
      && (rejectedProductIdentity || (latestDirectTerms.length > 0 && latestDirectTerms.length <= 4));
    const effectiveStockStatusRequested = stockStatusRequested || continuingProductDefinition;
    const currentAvailabilityRequested = wantsCurrentProductAvailability(latestUserMessage);
    const specialsRequested = wantsSpecials(latestUserMessage) && !stockStatusRequested;
    const catalogueOnlyTurn = ((specialsRequested
      || effectiveStockStatusRequested
      || broadCategoryQuestion
      || refiningBroadCategory
      || genericBroadContinuation
      || latestHasProductIntent)
      && !needsHealthKnowledge(latestUserMessage));
    const knowledgeQuery = isShortCategoryRefinement(latestUserMessage) && previousUserMessage
      ? `${previousUserMessage} ${latestUserMessage}`
      : latestUserMessage;
    const orderOnlyTurn = explicitlyWantsPurchaseHistory(latestUserMessage);
    const knowledge = catalogueOnlyTurn || petProfileOnlyTurn || orderOnlyTurn ? [] : await knowledgeService.search(knowledgeQuery, 2);
    // Include a small amount of recent conversation so a short follow-up such as
    // "it started last week" can still be related to the symptom just discussed.
    const recentPurchaseContext = userMessages.slice(-3).join(" ");
    const purchaseHistoryRelevant = purchaseHistoryCouldAnswer(recentPurchaseContext)
      || (effectiveStockStatusRequested && !rejectedProductIdentity);
    let recentOrders = [] as Awaited<ReturnType<typeof fetchRecentCustomerOrders>>;
    let recentPurchases = [] as CustomerOrder["lineItems"];
    let purchaseHistoryUnavailable = false;
    if (purchaseHistoryRelevant && customerSession.accessToken) {
      try {
        recentOrders = await fetchRecentCustomerOrders(customerSession.accessToken);
        recentPurchases = recentOrders.flatMap((order) => order.lineItems);
      } catch (error) {
        purchaseHistoryUnavailable = true;
        console.warn("[chat] purchase history unavailable", error instanceof Error ? error.message : "Unknown error");
      }
    }
    if (explicitlyWantsPurchaseHistory(latestUserMessage)) {
      console.info("[chat] purchase history lookup", {
        accessTokenPresent: Boolean(customerSession.accessToken),
        attempted: purchaseHistoryRelevant && Boolean(customerSession.accessToken),
        returnedOrders: recentOrders.length,
        returnedLineItems: recentPurchases.length,
        unavailable: purchaseHistoryUnavailable,
      });
    }
    const relevantPurchases = orderOnlyTurn && recentOrders[0]
      ? recentOrders[0].lineItems
      : purchasesRelevantToQuestion(recentPurchaseContext, recentPurchases);
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
    let directCatalogueListing = false;

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
      const searchSource = rejectedProductIdentity
        ? statusRequest
        : continuingProductDefinition
        ? `${statusRequest} ${latestUserMessage}`
        : retryingProductSearch
        ? latestProductRequest
        : useBroadCategorySearch
        ? broadCategorySearch
        : latestHasProductIntent ? latestUserMessage : latestProductRequest;
      const directTerms = productSearchTerms(searchSource).filter((term) => !petNameTerms.has(term));
      const directAnchorTerms = productSearchAnchors(directTerms);
      directCatalogueListing = !needsHealthKnowledge(latestUserMessage)
        && !orderOnlyTurn
        && directAnchorTerms.length > 0
        && (currentAvailabilityRequested || (!continuingProductDefinition && !wantsProductStockStatus(latestUserMessage)));
      const statusRequiredTerms = effectiveStockStatusRequested
        ? [...new Set([
          ...productStockSearchAnchors(productSearchTerms(statusRequest || latestUserMessage)),
          ...(continuingProductDefinition && !rejectedProductIdentity ? latestDirectTerms : []),
        ])]
        : [];
      if (targetSpecies && !directTerms.includes(targetSpecies)) directTerms.push(targetSpecies);
      const categoryRequiredTerms = useBroadCategorySearch
        ? [...new Set(broadCategoryMessages.flatMap(productSearchTerms).filter((term) => term !== "food"))]
        : [];
      const discoveryOnly = broadCategoryQuestion;
      const limit = directCatalogueListing ? 20
        : effectiveStockStatusRequested ? 12
        : discoveryOnly ? 6
        : refiningBroadCategory || genericBroadContinuation || recommendationContextReady ? 3 : 1;
      recommendations = await productService.recommendProducts(directTerms.length > 0
        ? [directTerms.join(" "), ...directTerms]
        : [...new Set(knowledge.flatMap((entry) => entry.relevantProductTags))], limit, {
          includeTreatAddon: recommendationContextReady,
          availableOnly: directCatalogueListing || (!discoveryOnly && !effectiveStockStatusRequested),
          // Specific searches must never degrade into an unrelated card just
          // because no exact product scored above zero.
          allowFallback: directTerms.length === 0 && !discoveryOnly && !targetSpecies,
          requiredTerms: categoryRequiredTerms.length > 0
            ? categoryRequiredTerms
            : statusRequiredTerms.length > 0 ? statusRequiredTerms
            : directAnchorTerms.length > 0 ? directAnchorTerms : undefined,
          species: targetSpecies,
        });

      if (rejectedProductIdentity && previousProductIds.length > 0) {
        recommendations = recommendations.filter(({ product }) => !rejectedProductIds.has(normalizeShopifyResourceId(product.id))
          && !rejectedProductIds.has(normalizeShopifyResourceId(product.variantId)));
      }

      if (effectiveStockStatusRequested && relevantPurchases.length > 0) {
        const purchaseMatchAnchors = productStockSearchAnchors(productSearchTerms(statusRequest || latestUserMessage));
        const matchingPurchasedProductIds = new Set(relevantPurchases
          .filter((purchase) => purchase.productId && purchaseMatchAnchors.every((term) => productTextMatchesSearchTerm(
            `${purchase.title} ${purchase.variantTitle || ""} ${purchase.productType || ""}`,
            term,
          )))
          .map((purchase) => normalizeShopifyResourceId(purchase.productId)));
        recommendations = [...recommendations].sort((left, right) => (
          Number(matchingPurchasedProductIds.has(normalizeShopifyResourceId(right.product.id)))
          - Number(matchingPurchasedProductIds.has(normalizeShopifyResourceId(left.product.id)))
        ));
      }

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

      // A customer may ask for "cream for it" immediately after describing a
      // red paw or itchy skin. If there is no literal cream match, surface
      // only relevant live paw/skin support items instead of a substring match
      // such as "Scream" toy.
      if (recommendations.length === 0
        && requestsTopicalSkinSupport(latestUserMessage)
        && mentionsSkinOrPawConcern(recentPetContext)) {
        recommendations = await productService.recommendProducts(
          ["paw", "skin", "itch", "balm", "salve", "spray"],
          3,
          { availableOnly: true, allowFallback: false, species: targetSpecies },
        );
      }

      // A direct request for skin-rash products should show a small set of
      // relevant live options even when literal required terms such as
      // "rash" do not appear in Shopify titles or tags.
      if (recommendations.length === 0
        && latestHasProductIntent
        && mentionsSkinOrPawConcern(recentPetContext)) {
        recommendations = await productService.recommendProducts(
          ["skin support", "skin", "itch", "paw", "balm", "salve", "spray", "shampoo"],
          3,
          { availableOnly: true, allowFallback: false, species: targetSpecies },
        );
      }
    }

    if (directCatalogueListing) {
      const variantDetailsRequested = wantsProductVariantDetails(latestUserMessage);
      const variantDetails = variantDetailsRequested && recommendations.length === 1
        ? variantDetailsReply(recommendations[0].product)
        : null;
      const productCards = variantDetailsRequested ? variantProductCards(recommendations) : recommendations;
      return Response.json({
        message: variantDetails ?? (recommendations.length > 0
          ? `Yes—these matching options are currently in stock.`
          : `I couldn’t verify any matching in-stock options in the current catalogue. Would you like me to email our team to get an answer to your enquiry?`),
        products: productCards,
        resetProductContext: false,
        pets: customerPets,
        mode: "catalogue-listing",
      });
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
    const purchasedProducts = (await Promise.all(recentProductIds.slice(0, orderOnlyTurn ? 20 : 6).map(async (productId) => {
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

    if (orderOnlyTurn) {
      if (!customerSession.accessToken || purchaseHistoryUnavailable) {
        return Response.json({
          message: "I couldn’t load your Shopify order history in this session. Please sign out and sign back in with your All Good Petfood account, then try again. Would you like me to email our team to get an answer to your enquiry?",
          products: [],
          resetProductContext: true,
          pets: customerPets,
          mode: "order-history-unavailable",
        });
      }
      if (recentOrders.length === 0) {
        return Response.json({
          message: "Shopify returned no orders for this signed-in customer account. Would you like me to email our team to get an answer to your enquiry?",
          products: [],
          resetProductContext: true,
          pets: customerPets,
          mode: "order-history-empty",
        });
      }
      return Response.json({
        message: orderHistoryReply(recentOrders[0]),
        products: purchasedProducts,
        resetProductContext: true,
        pets: customerPets,
        mode: "order-history",
      });
    }
    const groundingRecommendations = recommendations.length > 0
      ? recommendations
      : referencedProducts.length > 0
        ? referencedProducts
      : purchasedProducts;
    const discoveryOnly = broadCategoryQuestion;
    if (effectiveStockStatusRequested && recommendations.length > 0) {
      const candidate = recommendations[0];
      return Response.json({
        message: `I found ${candidate.product.title}. Is this the product you mean?`,
        products: [candidate],
        resetProductContext: false,
        pets: customerPets,
        mode: "product-clarification",
      });
    }
    if (rejectedProductIdentity) {
      return Response.json({
        message: "Thanks—that isn’t the one. I couldn’t identify another reliable catalogue match yet. What exact wording, brand, pack size, or product type appears on the product?",
        products: [],
        resetProductContext: true,
        pets: customerPets,
        mode: "product-clarification",
      });
    }
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
    if (result.mode !== "approved-knowledge") {
      result.content = guardPendingRecommendationCatalogueClaim(
        result.content,
        targetSpecies,
        (latestHasProductIntent || earlierProductIntent) && !recommendationContextReady,
      );
      if (responseNeedsTeamEmailOffer(result.content)) {
        result.content = `${result.content.trim()}\n\n${TEAM_EMAIL_OFFER}`;
      }
    }
    if (result.mode !== "approved-knowledge"
      && latestMessageIsContextualPetName && petProfileProposals.length > 0
      && !/\badd\b[\s\S]{0,80}\bMy Pets\b/i.test(result.content)) {
      const names = petProfileProposals.join(" and ");
      result.content = `${result.content.trim()}\n\nShall I add ${names} to My Pets? This helps me remember their details between conversations and make future guidance and product suggestions more relevant.`;
    }
    console.info("[chat] assistant response", { mode: result.mode, length: result.content.length });

    return Response.json({
      message: result.content,
      products: displayRecommendations,
      resetProductContext: discoveryOnly || (!latestHasProductIntent && displayRecommendations.length === 0),
      pets: customerPets,
      petProfileProposalNames: petProfileProposals,
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
