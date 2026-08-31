import type { KnowledgeEntry } from "@/types";

export function primaryApprovedKnowledge(entries: KnowledgeEntry[]) {
  return entries.find((entry) => entry.approvedExact && entry.content.trim()) ?? null;
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
