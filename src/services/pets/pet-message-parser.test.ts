import { describe, expect, it } from "vitest";
import { appearsToIntroduceNewPet, explicitlyRequestsPetSave, namedPets } from "./pet-message-parser";

describe("pet message parsing", () => {
  it("recognises an explicit comma-style request to add a new pet", () => {
    const message = "Can you add my cat, Smitty to My Pets? She's 15 and is a Cornish Rex";
    expect(namedPets(message)).toEqual([{ name: "Smitty", species: "cat" }]);
    expect(explicitlyRequestsPetSave(message)).toBe(true);
    expect(appearsToIntroduceNewPet(message)).toBe(true);
  });

  it("does not treat a normal fact correction as a new pet introduction", () => {
    expect(appearsToIntroduceNewPet("Queenie is 13 years old")).toBe(false);
  });

  it("does not mistake the word after an unnamed pet for its name", () => {
    expect(namedPets("Can you add my cat to My Pets?")).toEqual([]);
    expect(appearsToIntroduceNewPet("Can you add my cat to My Pets?")).toBe(true);
  });
});
