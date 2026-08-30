import entries from "../../../knowledge/entries.json";
import emailDerivedEntries from "../../../knowledge/email-derived.json";
import type { KnowledgeEntry } from "@/types";
import type { KnowledgeService } from "./types";

const knowledge = [...entries, ...emailDerivedEntries] as KnowledgeEntry[];
const STOP_WORDS = new Set([
  "about", "any", "cat", "could", "does", "dog", "for", "have", "help", "pet", "product", "products",
  "should", "their", "there", "they", "what", "when", "which", "with", "would", "you", "your",
]);

export function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) ?? [];
}

export function scoreKnowledge(entry: KnowledgeEntry, query: string): number {
  const queryTokens = tokenize(query);
  const title = entry.title.toLowerCase();
  const category = entry.category.toLowerCase();
  const body = `${entry.summary} ${entry.content}`.toLowerCase();
  return queryTokens.reduce((score, token) => {
    if (entry.tags.some((tag) => tag.toLowerCase().includes(token))) return score + 5;
    if (title.includes(token) || category.includes(token)) return score + 3;
    if (body.includes(token)) return score + 1;
    return score;
  }, 0);
}

export function rankKnowledge(entriesToRank: KnowledgeEntry[], query: string, limit: number) {
  return entriesToRank
    .map((entry) => ({ entry, score: scoreKnowledge(entry, query) }))
    // A single weak body-word match is not enough to justify returning an
    // approved answer verbatim. Require a title/category match or a tag match.
    .filter(({ score }) => score >= 3)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export class LocalKnowledgeService implements KnowledgeService {
  async search(query: string, limit = 3): Promise<KnowledgeEntry[]> {
    return rankKnowledge(knowledge.filter((entry) => entry.enabled), query, limit);
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    return knowledge.find((entry) => entry.id === id && entry.enabled) ?? null;
  }

  async listEnabled(): Promise<KnowledgeEntry[]> {
    return knowledge.filter((entry) => entry.enabled);
  }
}

export const knowledgeService: KnowledgeService = new LocalKnowledgeService();
