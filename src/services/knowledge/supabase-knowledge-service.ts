import "server-only";

import type { KnowledgeEntry } from "@/types";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { LocalKnowledgeService, scoreKnowledge } from "./local-knowledge-service";
import type { KnowledgeService } from "./types";

export interface ManagedKnowledgeEntry extends KnowledgeEntry {
  sourceCandidateId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  summary: string | null;
  follow_up_questions: string[];
  safety_notes: string[];
  tags: string[];
  relevant_product_tags: string[];
  recommended_product_urls: string[];
  source_candidate_id: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const columns = "id,question,answer,category,summary,follow_up_questions,safety_notes,tags,relevant_product_tags,recommended_product_urls,source_candidate_id,enabled,created_at,updated_at";

function fromRow(row: KnowledgeRow): ManagedKnowledgeEntry {
  return {
    id: row.id,
    title: row.question,
    category: row.category,
    summary: row.summary || row.answer.slice(0, 240),
    content: row.answer,
    followUpQuestions: row.follow_up_questions,
    safetyNotes: row.safety_notes,
    tags: row.tags,
    relevantProductTags: row.relevant_product_tags,
    recommendedProductUrls: row.recommended_product_urls,
    sourceCandidateId: row.source_candidate_id,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listManagedKnowledgeEntries(enabledOnly = false) {
  let query = getServerSupabaseClient()
    .from("knowledge_entries")
    .select(columns)
    .order("updated_at", { ascending: false });
  if (enabledOnly) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) throw new Error(`Managed knowledge query failed: ${error.message}`);
  return (data as KnowledgeRow[]).map(fromRow);
}

export class SupabaseKnowledgeService implements KnowledgeService {
  private readonly local = new LocalKnowledgeService();

  async search(query: string, limit = 3): Promise<KnowledgeEntry[]> {
    const localEntries = await this.local.listEnabled();
    try {
      const managedEntries = await listManagedKnowledgeEntries();
      if (!managedEntries.length) return localEntries
        .map((entry) => ({ entry, score: scoreKnowledge(entry, query) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ entry }) => entry);
      return managedEntries
        .filter((entry) => entry.enabled)
        .map((entry) => ({ entry, score: scoreKnowledge(entry, query) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ entry }) => entry);
    } catch (error) {
      console.warn("[knowledge] managed entries unavailable; using built-in knowledge", error instanceof Error ? error.message : "Unknown error");
      return localEntries
        .map((entry) => ({ entry, score: scoreKnowledge(entry, query) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ entry }) => entry);
    }
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    const localEntry = await this.local.getById(id);
    if (localEntry) return localEntry;
    try {
      const { data, error } = await getServerSupabaseClient()
        .from("knowledge_entries")
        .select(columns)
        .eq("id", id)
        .eq("enabled", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? fromRow(data as KnowledgeRow) : null;
    } catch (error) {
      console.warn("[knowledge] managed entry unavailable", error instanceof Error ? error.message : "Unknown error");
      return null;
    }
  }

  async listEnabled(): Promise<KnowledgeEntry[]> {
    const localEntries = await this.local.listEnabled();
    try {
      const managedEntries = await listManagedKnowledgeEntries();
      return managedEntries.length ? managedEntries.filter((entry) => entry.enabled) : localEntries;
    } catch (error) {
      console.warn("[knowledge] managed entries unavailable; using built-in knowledge", error instanceof Error ? error.message : "Unknown error");
      return localEntries;
    }
  }
}

export const knowledgeService: KnowledgeService = new SupabaseKnowledgeService();
