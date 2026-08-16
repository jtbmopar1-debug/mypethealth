import type { Conversation } from "@/types";
import type { ConversationStore } from "./types";

const STORAGE_KEY = "my-pet-health:conversations:v1";

function read(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function write(conversations: Conversation[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export class LocalStorageConversationStore implements ConversationStore {
  async list() {
    return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) {
    return read().find((conversation) => conversation.id === id) ?? null;
  }

  async save(conversation: Conversation) {
    const conversations = read().filter((item) => item.id !== conversation.id);
    write([conversation, ...conversations]);
  }

  async remove(id: string) {
    write(read().filter((conversation) => conversation.id !== id));
  }

  async clear() {
    write([]);
  }
}

export const conversationStore: ConversationStore = new LocalStorageConversationStore();
