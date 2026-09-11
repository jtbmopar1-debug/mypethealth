import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { answer, search, getProduct } = vi.hoisted(() => ({ answer: vi.fn(), search: vi.fn(), getProduct: vi.fn() }));
vi.mock("@/ai/assistant-service", () => ({ answerCustomer: answer }));
vi.mock("@/services/knowledge/supabase-knowledge-service", () => ({ knowledgeService: { search } }));
vi.mock("@/services/shopify/customer-auth", () => ({ SHOPIFY_SESSION_COOKIE: "session", readShopifySessionOrLocalDev: () => null }));
vi.mock("@/services/products/shopify-product-service", () => ({ ShopifyProductService: class { getProduct = getProduct; } }));
import { POST } from "./route";
import type { ChatMessage } from "@/types";
const m = (role: "user" | "assistant", content: string, productIds?: string[]): ChatMessage => ({ id: content, role, content, productIds, createdAt: "2026-09-11" });
async function send(messages: ChatMessage[]) {
  const response = await POST(new NextRequest("http://localhost/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: "11111111-1111-4111-8111-111111111111", messages }) }));
  expect(response.status).toBe(200);
  return response.json();
}
describe("guest chat follow-up contract", () => {
  beforeEach(() => {
    answer.mockClear();
    search.mockResolvedValue([]);
    getProduct.mockResolvedValue({ id: "pig", title: "Pig ears", description: "Pork chew", ingredients: ["Pork"], tags: [], price: 5, currency: "NZD", availability: "in_stock" });
    answer.mockResolvedValue({ content: "What is your dog's name, age and size?", recommendations: [], mode: "gemini" });
  });
  it("keeps product context through a no-card answer and forwards Bob's reply as requested details", async () => {
    const messages = [m("user", "Do you sell pig ears?"), m("assistant", "Yes", ["pig"]), m("user", "Are these known to cause issues with dogs?")];
    const first = await send(messages);
    expect(first.resetProductContext).toBe(false);
    messages.push(m("assistant", first.message, ["pig"]), m("user", "Bob, corgi - medium size, about 5yrs old"));
    const second = await send(messages);
    expect(second.resetProductContext).toBe(false);
    expect(answer.mock.lastCall?.[2][0].product.id).toBe("pig");
    expect(answer.mock.lastCall?.[3].turnContext.answeringQuestion).toBe(true);
  });
  it("allows normal advice containing my pet", async () => {
    await send([m("user", "My pet is itchy")]);
    expect(answer).toHaveBeenCalled();
  });
  it("handles emergencies without generation", async () => {
    answer.mockClear();
    const result = await send([m("user", "My dog can't breathe")]);
    expect(result.mode).toBe("urgent-care");
    expect(answer).not.toHaveBeenCalled();
  });
  it("distinguishes catalogue outage from missing stock", async () => {
    getProduct.mockRejectedValueOnce(new Error("CATALOGUE_UNAVAILABLE"));
    const result = await send([m("user", "Do you sell pig ears?"), m("assistant", "Yes", ["pig"]), m("user", "Are these suitable?")]);
    expect(result.mode).toBe("catalogue-unavailable");
    expect(result.resetProductContext).toBe(false);
  });
});
