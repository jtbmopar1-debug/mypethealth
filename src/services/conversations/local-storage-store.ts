import type { Conversation } from "@/types";
import type { ConversationStore } from "./types";

function read(key: string | null): Conversation[] {
  if (!key) return [];
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function write(key: string | null, conversations: Conversation[]) {
  if (!key) throw new Error("An account is required for local chat storage");
  window.localStorage.setItem(key, JSON.stringify(conversations));
}

export class LocalStorageConversationStore implements ConversationStore {
  constructor(private readonly customerId?: string) {}
  private get key() { return this.customerId ? `my-pet-health:conversations:v2:${encodeURIComponent(this.customerId)}` : null; }
  async list() {
    return read(this.key).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) {
    return read(this.key).find((conversation) => conversation.id === id) ?? null;
  }

  async save(conversation: Conversation) {
    const conversations = read(this.key).filter((item) => item.id !== conversation.id);
    write(this.key, [conversation, ...conversations]);
  }

  async remove(id: string) {
    write(this.key, read(this.key).filter((conversation) => conversation.id !== id));
  }

  async clear() {
    if (this.key) window.localStorage.removeItem(this.key);
  }
}

export const conversationStore: ConversationStore = new LocalStorageConversationStore();
