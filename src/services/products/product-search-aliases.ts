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

export function containsProductSearchAlias(terms: string[]) {
  const normalized = new Set(terms.map((term) => term.trim().toLowerCase()).filter(Boolean));
  return aliasGroups.some((group) => group.some((alias) => normalized.has(alias)));
}

export function productTextMatchesSearchTerm(searchableText: string, term: string) {
  const normalizedText = searchableText.toLowerCase();
  return expandProductSearchAliases([term]).some((alias) => {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escapedAlias}(?:s|es)?(?=$|[^a-z0-9])`, "i").test(normalizedText);
  });
}
