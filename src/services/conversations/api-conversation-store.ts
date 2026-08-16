import type { Conversation } from "@/types";
import type { ConversationStore } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || "Cloud conversation request failed");
  return data;
}

export class ApiConversationStore implements ConversationStore {
  async list() {
    return (await request<{ conversations: Conversation[] }>("/api/conversations")).conversations;
  }

  async get(id: string) {
    return (await request<{ conversation: Conversation | null }>(`/api/conversations?id=${encodeURIComponent(id)}`)).conversation;
  }

  async save(conversation: Conversation) {
    await request<{ ok: true }>("/api/conversations", {
      method: "PUT",
      body: JSON.stringify({ conversation }),
    });
  }

  async remove(id: string) {
    await request<{ ok: true }>(`/api/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async clear() {
    await request<{ ok: true }>("/api/conversations", { method: "DELETE" });
  }
}

export const apiConversationStore = new ApiConversationStore();
