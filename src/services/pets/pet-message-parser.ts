export interface NamedPetMention {
  name: string;
  species: "dog" | "cat" | null;
}

interface PetNameConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ContextualNamedPetMention extends NamedPetMention {
  messageIndex: number;
  contextStartIndex: number;
}

function cleanName(value: string) {
  const cleaned = value.trim().replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, "").slice(0, 80);
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : "";
}

export function namedPets(message: string) {
  const matches: NamedPetMention[] = [];
  const patterns: { regex: RegExp; speciesIndex?: number; nameIndex: number }[] = [
    { regex: /\bmy\s+(dog|puppy|pup|cat|kitten)\s+(?:is\s+)?(?:named|called)\s+([A-Za-z][A-Za-z'-]{0,39})\b/gi, speciesIndex: 1, nameIndex: 2 },
    { regex: /\bi\s+(?:also\s+)?have\s+(?:a|an|another)\s+(dog|puppy|pup|cat|kitten)(?:\s+[A-Za-z][A-Za-z -]{0,60})?\s+(?:named|called)\s+([A-Za-z][A-Za-z'-]{0,39})\b/gi, speciesIndex: 1, nameIndex: 2 },
    { regex: /\bmy\s+(dog|puppy|pup|cat|kitten)\s+([A-Za-z][A-Za-z'-]{0,39})\s+(?:is|has|was)\b/gi, speciesIndex: 1, nameIndex: 2 },
    { regex: /\b([A-Za-z][A-Za-z'-]{0,39})\s+is\s+my\s+(dog|puppy|pup|cat|kitten)\b/gi, speciesIndex: 2, nameIndex: 1 },
    { regex: /\b(?:his|her|their|my pet'?s?)\s+name\s+is\s+([A-Za-z][A-Za-z'-]{0,39})\b/gi, nameIndex: 1 },
    { regex: /\b(?:add|save|remember)\s+my\s+(dog|puppy|pup|cat|kitten)\s*[,;:-]\s*([A-Za-z][A-Za-z'-]{0,39})\b/gi, speciesIndex: 1, nameIndex: 2 },
    { regex: /\bmy\s+(dog|puppy|pup|cat|kitten)\s*[,;:-]\s*([A-Za-z][A-Za-z'-]{0,39})\b/gi, speciesIndex: 1, nameIndex: 2 },
  ];

  for (const { regex, speciesIndex, nameIndex } of patterns) {
    for (const match of message.matchAll(regex)) {
      const name = cleanName(match[nameIndex] || "");
      if (!name) continue;
      const rawSpecies = speciesIndex ? match[speciesIndex]?.toLowerCase() : null;
      const species = rawSpecies && /^(?:cat|kitten)$/.test(rawSpecies) ? "cat" : rawSpecies ? "dog" : null;
      if (!matches.some((item) => item.name.toLowerCase() === name.toLowerCase())) matches.push({ name, species });
    }
  }
  return matches;
}

export function contextualNamedPetReply(messages: PetNameConversationMessage[]): ContextualNamedPetMention | null {
  for (let index = messages.length - 1; index > 0; index -= 1) {
    const message = messages[index];
    const previous = messages[index - 1];
    if (message.role !== "user" || previous.role !== "assistant") continue;
    const asksForPetName = /\b(?:pet|dog|cat|puppy|kitten|companion|they|them|he|him|she|her)\b[\s\S]{0,100}\bname\b/i.test(previous.content)
      || /\bname\b[\s\S]{0,100}\b(?:pet|dog|cat|puppy|kitten|companion|they|them|he|him|she|her)\b/i.test(previous.content);
    if (!asksForPetName || !/\?|\b(?:tell|hear|know)\b/i.test(previous.content)) continue;

    const rawName = message.content.trim();
    if (!/^[A-Za-z][A-Za-z'-]{0,39}(?:\s+[A-Za-z][A-Za-z'-]{0,39})?$/.test(rawName)) continue;
    if (/^(?:yes|no|okay|ok|sure|unknown|unsure|maybe|none)$/i.test(rawName)) continue;

    const name = rawName.split(/\s+/).map(cleanName).filter(Boolean).join(" ");
    if (!name) continue;
    let contextStartIndex = Math.max(0, index - 8);
    for (let contextIndex = index - 2; contextIndex >= contextStartIndex; contextIndex -= 1) {
      const candidate = messages[contextIndex];
      if (candidate.role === "user" && /\b(?:pet|dog|puppy|pup|cat|kitten)\b/i.test(candidate.content)) {
        contextStartIndex = contextIndex;
        break;
      }
    }
    const earlierUserText = messages.slice(contextStartIndex, index + 1).reverse()
      .filter((item) => item.role === "user")
      .map((item) => item.content)
      .join(" ");
    const species = /\b(?:cat|kitten)\b/i.test(earlierUserText) ? "cat"
      : /\b(?:dog|puppy|pup)\b/i.test(earlierUserText) ? "dog"
        : null;
    return { name, species, messageIndex: index, contextStartIndex };
  }
  return null;
}

export function explicitlyRequestsPetSave(message: string) {
  return /\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:add|save|remember)\b/i.test(message)
    || /\b(?:please\s+)?(?:add|save|remember)\s+(?:my|our|the)\s+(?:dog|puppy|pup|cat|kitten|pet)\b/i.test(message);
}

export function appearsToIntroduceNewPet(message: string) {
  return explicitlyRequestsPetSave(message)
    || /\b(?:another|new)\s+(?:dog|puppy|pup|cat|kitten|pet)\b/i.test(message)
    || /\bmy\s+(?:dog|puppy|pup|cat|kitten)\s*(?:named|called|[,;:-])/i.test(message);
}
