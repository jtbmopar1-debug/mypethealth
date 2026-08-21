import { describe, expect, it } from "vitest";
import { appearsToIntroduceNewPet, contextualNamedPetReply, explicitlyRequestsPetSave, namedPets } from "./pet-message-parser";

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

  it("recognises a pet name supplied as a direct reply to Buddy's question", () => {
    expect(contextualNamedPetReply([
      { role: "user", content: "I'm thinking about getting a dog, a Japanese Spitz" },
      { role: "assistant", content: "Do they have a name yet?" },
      { role: "user", content: "Misa" },
    ])).toEqual({ name: "Misa", species: "dog", messageIndex: 2, contextStartIndex: 0 });
  });

  it("does not treat an ordinary one-word reply as a pet name", () => {
    expect(contextualNamedPetReply([
      { role: "assistant", content: "Do you know what food they eat?" },
      { role: "user", content: "Unknown" },
    ])).toBeNull();
  });

  it("does not mistake the customer's own name for a pet", () => {
    expect(contextualNamedPetReply([
      { role: "assistant", content: "What is your name?" },
      { role: "user", content: "John" },
    ])).toBeNull();
  });
});
