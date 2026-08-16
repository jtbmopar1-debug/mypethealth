import entries from "../../../knowledge/entries.json";
import type { KnowledgeEntry } from "@/types";
import type { KnowledgeService } from "./types";

const knowledge = entries as KnowledgeEntry[];
const STOP_WORDS = new Set(["about", "could", "does", "have", "help", "should", "their", "there", "they", "what", "when", "which", "with", "would", "your"]);

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

export class LocalKnowledgeService implements KnowledgeService {
  async search(query: string, limit = 3): Promise<KnowledgeEntry[]> {
    return knowledge
      .filter((entry) => entry.enabled)
      .map((entry) => ({ entry, score: scoreKnowledge(entry, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => entry);
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    return knowledge.find((entry) => entry.id === id && entry.enabled) ?? null;
  }

  async listEnabled(): Promise<KnowledgeEntry[]> {
    return knowledge.filter((entry) => entry.enabled);
  }
}

export const knowledgeService: KnowledgeService = new LocalKnowledgeService();
