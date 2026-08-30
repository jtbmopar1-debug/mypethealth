import type { NextRequest } from "next/server";
import { z } from "zod";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";
import { loadCustomerConversation } from "@/services/conversations/customer-conversation-service";
import { ContactTeamRateLimitError, sendContactTeamEnquiry } from "@/services/enquiries/contact-team-service";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  customerMessage: z.string().trim().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const session = readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });
  if (!session.email) return Response.json({ error: "Your Shopify account needs an email address before this can be sent." }, { status: 400 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a message for the team before sending." }, { status: 400 });

  let conversation;
  try {
    conversation = await loadCustomerConversation(session.customerId, parsed.data.conversationId);
  } catch (error) {
    console.error("[contact-team] conversation lookup failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Your saved chat could not be loaded." }, { status: 503 });
  }
  if (!conversation) return Response.json({ error: "That conversation could not be found." }, { status: 404 });
  if (!conversation.messages.some((message) => message.role === "user")) {
    return Response.json({ error: "Ask Buddy a question before contacting the team." }, { status: 400 });
  }

  try {
    const sent = await sendContactTeamEnquiry({
      shopifyCustomerId: session.customerId,
      customerEmail: session.email,
      customerName: [session.firstName, session.lastName].filter(Boolean).join(" "),
      customerMessage: parsed.data.customerMessage,
      conversation,
    });
    return Response.json({ ok: true, sentAt: sent.sentAt, alreadySent: sent.alreadySent });
  } catch (sendError) {
    if (sendError instanceof ContactTeamRateLimitError) {
      return Response.json({ error: "You have already sent three team messages in the last 24 hours." }, { status: 429 });
    }
    console.error("[contact-team] send failed", sendError instanceof Error ? sendError.message : "Unknown error");
    return Response.json({ error: "Your message could not be emailed right now. Please try again shortly." }, { status: 503 });
  }
}
