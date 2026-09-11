import { afterEach, expect, it, vi } from "vitest";
import { LocalStorageConversationStore } from "./local-storage-store";
afterEach(() => vi.unstubAllGlobals());
it("isolates local fallback by account and never imports legacy chats", async () => {
  const values = new Map<string, string>([["my-pet-health:conversations:v1", '[{"id":"legacy"}]']]);
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => values.get(k), setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) } });
  const a = new LocalStorageConversationStore("a");
  const b = new LocalStorageConversationStore("b");
  await a.save({ id: "chat", title: "Private", messages: [], createdAt: "2026-09-11", updatedAt: "2026-09-11" });
  expect(await b.list()).toEqual([]);
  expect(await a.list()).toHaveLength(1);
  expect(await new LocalStorageConversationStore().list()).toEqual([]);
});
