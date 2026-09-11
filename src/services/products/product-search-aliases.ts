const aliasGroups = [
  ["treat", "chew", "ear", "bite", "snack", "jerky", "reward", "marshmallow"],
  ["bully", "bull", "pizzle"],
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

export function productTextMatchesRequiredTerm(searchableText: string, term: string) {
  const normalizedTerm = term.trim().toLowerCase();
  const broadAliases = new Set(["treat", "food", "wet", "parasite", "lead", "leash", "bully", "bull", "pizzle"]);
  const candidates = broadAliases.has(normalizedTerm) ? expandProductSearchAliases([normalizedTerm]) : [normalizedTerm];
  return candidates.some((candidate) => {
    const escapedCandidate = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^a-z0-9])${escapedCandidate}(?:s|es)?(?=$|[^a-z0-9])`, "i").test(searchableText)) return true;

    // Shopify and customers do not always agree about spaces or hyphens in
    // compound product names. The caller supplies the whole compact identity
    // (not an individual fragment), so comparing canonical forms remains
    // strict while allowing "Pancrea Care" to match "PancreaCare".
    const compactCandidate = candidate.replace(/[^a-z0-9]/g, "");
    const compactText = searchableText.toLowerCase().replace(/[^a-z0-9]/g, "");
    return compactCandidate.length >= 8 && compactText.includes(compactCandidate);
  });
}
