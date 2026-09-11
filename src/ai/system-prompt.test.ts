import { describe, expect, it } from "vitest";
import { MY_PET_HEALTH_SYSTEM_PROMPT } from "./system-prompt";

describe("Buddy system prompt product facts", () => {
  it("distinguishes an ingredient-derived recipe base from an explicit flavour", () => {
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("recipe base and flavour as different facts");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("fish meal supports saying that a product is fish-based");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("State a flavour only when");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("rather than repeating catalogue advertising");
    expect(MY_PET_HEALTH_SYSTEM_PROMPT).toContain("distinguish nutritional suitability from biscuit or kibble size");
  });
});
