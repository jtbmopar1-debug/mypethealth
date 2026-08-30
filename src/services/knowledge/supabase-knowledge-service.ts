import "server-only";

import type { KnowledgeEntry } from "@/types";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { LocalKnowledgeService, rankKnowledge, tokenize } from "./local-knowledge-service";
import type { KnowledgeService } from "./types";

export interface ManagedKnowledgeEntry extends KnowledgeEntry {
  sourceCandidateId: string | null;
  createdAt: string;
  updatedAt: string;
  publicationStatus: "draft" | "published" | "archived";
  lastVerifiedAt: string | null;
  reviewAfter: string | null;
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
  publication_status: "draft" | "published" | "archived";
  last_verified_at: string | null;
  review_after: string | null;
}

const columns = "id,question,answer,category,summary,follow_up_questions,safety_notes,tags,relevant_product_tags,recommended_product_urls,source_candidate_id,enabled,publication_status,last_verified_at,review_after,created_at,updated_at";

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
    publicationStatus: row.publication_status,
    lastVerifiedAt: row.last_verified_at,
    reviewAfter: row.review_after,
    approvedExact: row.publication_status === "published" && row.enabled,
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
      const searchTerms = tokenize(query);
      const { data, error } = await getServerSupabaseClient().rpc("search_published_knowledge", {
        // Natural customer questions contain filler words that made the old
        // web-search query require every remaining term. OR retrieves a small
        // candidate set; rankKnowledge then selects the genuinely relevant
        // approved answer using the original question.
        search_text: searchTerms.length ? searchTerms.join(" OR ") : query,
        result_limit: 10,
      });
      if (error) throw new Error(error.message);
      const managedEntries = ((data || []) as KnowledgeRow[]).map(fromRow);
      const rankedManagedEntries = rankKnowledge(managedEntries, query, limit);
      if (rankedManagedEntries.length) return rankedManagedEntries;
      return rankKnowledge(localEntries, query, limit);
    } catch (error) {
      console.warn("[knowledge] managed entries unavailable; using built-in knowledge", error instanceof Error ? error.message : "Unknown error");
      return rankKnowledge(localEntries, query, limit);
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
        .eq("publication_status", "published")
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
      return managedEntries.length
        ? managedEntries.filter((entry) => entry.enabled && entry.publicationStatus === "published")
        : localEntries;
    } catch (error) {
      console.warn("[knowledge] managed entries unavailable; using built-in knowledge", error instanceof Error ? error.message : "Unknown error");
      return localEntries;
    }
  }
}

export const knowledgeService: KnowledgeService = new SupabaseKnowledgeService();
