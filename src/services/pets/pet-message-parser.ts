export interface NamedPetMention {
  name: string;
  species: "dog" | "cat" | null;
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

export function explicitlyRequestsPetSave(message: string) {
  return /\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:add|save|remember)\b/i.test(message)
    || /\b(?:please\s+)?(?:add|save|remember)\s+(?:my|our|the)\s+(?:dog|puppy|pup|cat|kitten|pet)\b/i.test(message);
}

export function appearsToIntroduceNewPet(message: string) {
  return explicitlyRequestsPetSave(message)
    || /\b(?:another|new)\s+(?:dog|puppy|pup|cat|kitten|pet)\b/i.test(message)
    || /\bmy\s+(?:dog|puppy|pup|cat|kitten)\s*(?:named|called|[,;:-])/i.test(message);
}
