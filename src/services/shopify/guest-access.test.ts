import { describe, expect, it } from "vitest";
import { guestAccountFeatureReply, guestAccountFeatureRequested } from "./guest-access";

describe("guest account boundaries", () => {
  it("allows everyday references to a pet", () => {
    expect(guestAccountFeatureRequested("My pet is itchy")).toBe(false);
    expect(guestAccountFeatureRequested("Is this suitable for my pet?")).toBe(false);
  });
  it("allows ordinary advice and live catalogue questions", () => {
    expect(guestAccountFeatureRequested("Is PancreaCare wheat-free and in stock?")).toBe(false);
    expect(guestAccountFeatureRequested("Show me products for a small dog")).toBe(false);
    expect(guestAccountFeatureRequested("Which option will save me money?")).toBe(false);
  });

  it("requires an account for persistent and customer-specific features", () => {
    expect(guestAccountFeatureRequested("Remember that my dog is called Pip")).toBe(true);
    expect(guestAccountFeatureRequested("Show my recent orders")).toBe(true);
    expect(guestAccountFeatureRequested("Save this chat")).toBe(true);
    expect(guestAccountFeatureRequested("Add it to my cart")).toBe(true);
  });

  it("directs guest purchases through the live All Good product card", () => {
    expect(guestAccountFeatureReply("Add it to my cart")).toContain("selecting View product");
    expect(guestAccountFeatureReply("Add it to my cart")).toContain("All Good Petfood");
  });
});
