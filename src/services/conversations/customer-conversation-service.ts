import "server-only";

import { getServerSupabaseClient } from "@/services/supabase/server";
import type { Conversation } from "@/types";

interface ConversationRow {
  id: string;
  title: string;
  messages: Conversation["messages"];
  pet_profile: Conversation["petProfile"] | null;
  created_at: string;
  updated_at: string;
}

export async function loadCustomerConversation(shopifyCustomerId: string, conversationId: string) {
  const { data, error } = await getServerSupabaseClient()
    .from("shopify_conversations")
    .select("id,title,messages,pet_profile,created_at,updated_at")
    .eq("id", conversationId)
    .eq("shopify_customer_id", shopifyCustomerId)
    .maybeSingle();
  if (error) throw new Error(`Conversation lookup failed: ${error.message}`);
  if (!data) return null;

  const row = data as ConversationRow;
  return {
    id: row.id,
    title: row.title,
    messages: row.messages,
    petProfile: row.pet_profile ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies Conversation;
}
