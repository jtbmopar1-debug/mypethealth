import { z } from "zod";
import { answerCustomer } from "@/ai/assistant-service";
import { knowledgeService } from "@/services/knowledge/local-knowledge-service";
import { productService } from "@/services/products/mock-product-service";

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
  createdAt: z.string(),
  productIds: z.array(z.string()).optional()
});

const bodySchema = z.object({ messages: z.array(messageSchema).min(1).max(40) });

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Please send a valid message." }, { status: 400 });
    }

    const { messages } = parsed.data;
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    const knowledge = await knowledgeService.search(latestUserMessage, 3);
    const productTags = [...new Set(knowledge.flatMap((entry) => entry.relevantProductTags))];
    const recommendations = await productService.recommendProducts(productTags, 2);

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
