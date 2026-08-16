import type { Conversation } from "@/types";

export interface ConversationStore {
  list(): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
