import type { KnowledgeEntry } from "@/types";

export function primaryApprovedKnowledge(entries: KnowledgeEntry[]) {
  const entry = entries[0];
  return entry?.approvedExact && entry.content.trim() ? entry : null;
}

export function primaryKnowledgeProductControls(entries: KnowledgeEntry[]) {
  const entry = primaryApprovedKnowledge(entries);
  return {
    controlled: Boolean(entry),
    entry,
    productUrls: entry?.recommendedProductUrls ?? [],
    productTags: entry?.relevantProductTags ?? [],
  };
}
