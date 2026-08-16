import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation } from "@/types";
import type { ConversationStore } from "./types";

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Conversation["messages"];
  pet_profile: Conversation["petProfile"] | null;
}

function fromRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: row.messages,
    petProfile: row.pet_profile ?? undefined,
  };
}

export class SupabaseConversationStore implements ConversationStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async list() {
    const { data, error } = await this.client
      .from("conversations")
      .select("id,title,created_at,updated_at,messages,pet_profile")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as ConversationRow[]).map(fromRow);
  }

  async get(id: string) {
    const { data, error } = await this.client
      .from("conversations")
      .select("id,title,created_at,updated_at,messages,pet_profile")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as ConversationRow) : null;
  }

  async save(conversation: Conversation) {
    const { error } = await this.client.from("conversations").upsert({
      id: conversation.id,
      user_id: this.userId,
      title: conversation.title,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
      messages: conversation.messages,
      pet_profile: conversation.petProfile ?? null,
    });
    if (error) throw error;
  }

  async remove(id: string) {
    const { error } = await this.client
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) throw error;
  }

  async clear() {
    const { error } = await this.client
      .from("conversations")
      .delete()
      .eq("user_id", this.userId);
    if (error) throw error;
  }
}
