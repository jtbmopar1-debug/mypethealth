import { describe, expect, it } from "vitest";
import { managedKnowledgeUsesExactCopy } from "./managed-knowledge-policy";

describe("managed knowledge response policy", () => {
  it("uses exact copy only for operational facts", () => {
    expect(managedKnowledgeUsesExactCopy("store-information")).toBe(true);
    expect(managedKnowledgeUsesExactCopy("product-labels")).toBe(true);
    expect(managedKnowledgeUsesExactCopy("diet-and-allergies")).toBe(false);
    expect(managedKnowledgeUsesExactCopy("pancreatitis")).toBe(false);
  });
});
