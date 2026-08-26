import type { NextRequest } from "next/server";
import { z } from "zod";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { ContactTeamRateLimitError, sendContactTeamEnquiry } from "@/services/enquiries/contact-team-service";
import type { Conversation } from "@/types";

const requestSchema = z.object({
  conversationId: z.string().uuid(),
  customerMessage: z.string().trim().min(1).max(2000),
});

interface ConversationRow {
  id: string;
  title: string;
  messages: Conversation["messages"];
  pet_profile: Conversation["petProfile"] | null;
  created_at: string;
  updated_at: string;
}

export async function POST(request: NextRequest) {
  const session = readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });
  if (!session.email) return Response.json({ error: "Your Shopify account needs an email address before this can be sent." }, { status: 400 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a message for the team before sending." }, { status: 400 });

  const { data, error } = await getServerSupabaseClient()
    .from("shopify_conversations")
    .select("id,title,messages,pet_profile,created_at,updated_at")
    .eq("id", parsed.data.conversationId)
    .eq("shopify_customer_id", session.customerId)
    .maybeSingle();
  if (error) {
    console.error("[contact-team] conversation lookup failed", error.message);
    return Response.json({ error: "Your saved chat could not be loaded." }, { status: 503 });
  }
  if (!data) return Response.json({ error: "That conversation could not be found." }, { status: 404 });

  const row = data as ConversationRow;
  const conversation: Conversation = {
    id: row.id,
    title: row.title,
    messages: row.messages,
    petProfile: row.pet_profile ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
