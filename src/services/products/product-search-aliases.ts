const aliasGroups = [
  ["treat", "chew", "ear", "bite", "snack", "jerky", "reward", "marshmallow"],
  ["lead", "leash"],
  ["food", "feed", "kibble", "diet", "meal"],
  ["wet", "canned", "can", "pouch"],
  ["flea", "tick", "parasite"],
] as const;

export function expandProductSearchAliases(terms: string[]) {
  const expanded = new Set(terms.map((term) => term.trim().toLowerCase()).filter(Boolean));

  for (const group of aliasGroups) {
    if (group.some((alias) => expanded.has(alias))) {
      group.forEach((alias) => expanded.add(alias));
    }
  }

  return [...expanded];
}
