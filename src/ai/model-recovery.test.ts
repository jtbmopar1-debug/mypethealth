import { beforeEach, describe, expect, it, vi } from "vitest";
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({ serverConfig: { geminiApiKey: "test", geminiModel: "test" } }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: generate }; } }));
import { answerCustomer } from "./assistant-service";
const messages = [{ id: "1", role: "user" as const, content: "Hello", createdAt: "2026-09-11" }];
describe("model recovery", () => {
  beforeEach(() => generate.mockReset());
  it("retries empty exhausted output with a larger allowance", async () => {
    generate.mockResolvedValueOnce({ text: "", candidates: [{ finishReason: "MAX_TOKENS" }] });
    generate.mockResolvedValueOnce({ text: "Hello (welcome)", candidates: [{ finishReason: "STOP" }] });
    expect((await answerCustomer(messages, [], [])).content).toBe("Hello (welcome)");
    expect(generate.mock.calls[1][0].config.maxOutputTokens).toBeGreaterThan(generate.mock.calls[0][0].config.maxOutputTokens);
  });
  it("does not expose a blocked partial answer", async () => {
    generate.mockResolvedValue({ text: "Unsafe partial", candidates: [{ finishReason: "SAFETY" }] });
    expect((await answerCustomer(messages, [], [])).content).not.toContain("Unsafe partial");
  });
});
