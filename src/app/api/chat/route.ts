import { z } from "zod";
import type { NextRequest } from "next/server";
import { answerCustomer } from "@/ai/assistant-service";
import { knowledgeService } from "@/services/knowledge/local-knowledge-service";
import { productService } from "@/services/products/mock-product-service";
import { readShopifySession, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
  createdAt: z.string(),
  productIds: z.array(z.string()).optional()
});

const bodySchema = z.object({ messages: z.array(messageSchema).min(1).max(40) });

function wantsProductSuggestion(message: string) {
  const text = message.toLowerCase();
  const explicitPhrases = [
    "product suggestion",
    "product recommendations",
    "recommend a product",
    "recommend products",
    "suggest a product",
    "suggest products",
    "help me choose a product",
    "help me pick a product",
    "what product should i",
    "which product should i",
    "what should i buy",
    "what should i feed",
    "what food should i buy",
    "what food do you recommend",
    "what would you recommend",
    "show me products",
    "show me some products",
    "best product",
    "best food",
    "best dog food",
    "best cat food",
    "product for",
    "food for",
  ];

  if (explicitPhrases.some((phrase) => text.includes(phrase))) return true;

  // Customers do not always use the words “recommendation” or “product”.
  // Requests such as “suggest a better food” and “is there a better option?”
  // are still explicit product-shopping intent.
  return /\b(?:suggest|recommend|better|alternative|switch)\b[\w\s]{0,30}\b(?:food|diet|option|product|brand)\b/i.test(text)
    || /\b(?:food|diet|option|product|brand)\b[\w\s]{0,30}\b(?:suggest|recommend|better|alternative)\b/i.test(text);
}

export async function POST(request: NextRequest) {
  try {
    const customerSession = readShopifySession(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
    if (!customerSession) {
      return Response.json({ error: "Sign in with All Good Petfood to chat with Buddy." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Please send a valid message." }, { status: 400 });
    }

    const { messages } = parsed.data;
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    const knowledge = await knowledgeService.search(latestUserMessage, 3);
    const recommendations = wantsProductSuggestion(latestUserMessage)
      ? await productService.recommendProducts([...new Set(knowledge.flatMap((entry) => entry.relevantProductTags))], 2)
      : [];

    console.info("[chat] user message", { length: latestUserMessage.length });
    console.info("[chat] knowledge retrieved", knowledge.map((entry) => entry.id));
    console.info("[chat] products retrieved", recommendations.map(({ product }) => product.id));

    const result = await answerCustomer(messages, knowledge, recommendations);
    console.info("[chat] assistant response", { mode: result.mode, length: result.content.length });

    return Response.json({
      message: result.content,
      products: result.recommendations,
      mode: result.mode
    });
  } catch (error) {
    console.error("[chat] error", error instanceof Error ? { name: error.name, message: error.message } : "Unknown error");
    return Response.json({ error: "The assistant is having trouble responding. Please try again." }, { status: 500 });
  }
}
