import type { KnowledgeEntry } from "@/types";

export interface KnowledgeService {
  search(query: string, limit?: number): Promise<KnowledgeEntry[]>;
  getById(id: string): Promise<KnowledgeEntry | null>;
  listEnabled(): Promise<KnowledgeEntry[]>;
}
