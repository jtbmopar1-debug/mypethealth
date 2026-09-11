import { describe, expect, it } from "vitest";
import { MY_PET_HEALTH_SYSTEM_PROMPT, buildGroundedInstructions } from "./system-prompt";

describe("Buddy system prompt product facts", () => {
  it("keeps the guest and a named animal as separate identities", () => {
    const prompt = buildGroundedInstructions([], [], { guestMode: true });
    expect(prompt).toContain("their name is unknown");
    expect(prompt).toContain('never "Hello Bob"');
    expect(prompt).toContain("ask for the brand or ingredient label");
  });
  it("distinguishes an ingredient-derived recipe base from an explicit flavour", () => {
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("recipe base and flavour as different facts");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("fish meal supports saying that a product is fish-based");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("State a flavour only when");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("rather than repeating catalogue advertising");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("distinguish nutritional suitability from biscuit or kibble size");
  });
});
