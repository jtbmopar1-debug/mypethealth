import { describe, expect, it } from "vitest";
import { resolveTurn } from "./turn-context";
import { createLocalResponse } from "./local-responder";
import type { ChatMessage } from "@/types";

describe("product conversation continuity", () => {
  const message = (role: "user" | "assistant", content: string, productIds?: string[]): ChatMessage => ({ id: content, role, content, productIds, createdAt: "2026-09-11" });
  const start = [message("user", "Do you sell pig ears?"), message("assistant", "Yes, here they are.", ["pig-ear"])];
  it("preserves the product across safety advice and the requested pet details", () => {
    const safety = [...start, message("user", "Are these known to cause issues with dogs?")];
    const first = resolveTurn(safety);
    expect(first.productIds).toEqual(["pig-ear"]);
    const details = [...safety, message("assistant", "What is your dog's name, age and size?", first.productIds), message("user", "Bob, corgi - medium size, about 5yrs old")];
    const turn = resolveTurn(details);
    expect(turn).toMatchObject({ answeringQuestion: true, productIds: ["pig-ear"] });
    expect(createLocalResponse(details, [], [], { turnContext: turn }).content).not.toContain("their age");
  });
  it("clears the old product for a new shopping request", () => {
    expect(resolveTurn([...start, message("user", "Do you sell cat litter?")]).productIds).toEqual([]);
  });
});
