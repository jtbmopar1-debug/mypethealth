import type { NextRequest } from "next/server";
import { z } from "zod";
import { isAdminEmail } from "@/services/admin-auth";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { listManagedKnowledgeEntries } from "@/services/knowledge/supabase-knowledge-service";

const idSchema = z.string().uuid();
const recommendedProductUrlSchema = z.string().trim().url().max(1000).refine((value) => {
  try {
    const url = new URL(value);
    return (url.hostname === "allgoodpetfood.co.nz" || url.hostname === "www.allgoodpetfood.co.nz")
      && url.pathname.startsWith("/products/");
  } catch {
    return false;
  }
}, "Use an All Good Petfood product URL");
const entrySchema = z.object({
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(10).max(12000),
  category: z.string().trim().min(2).max(100),
  summary: z.string().trim().max(500).nullable(),
  followUpQuestions: z.array(z.string().trim().min(2).max(300)).max(12),
  safetyNotes: z.array(z.string().trim().min(2).max(500)).max(12),
  tags: z.array(z.string().trim().min(1).max(100)).max(40),
  relevantProductTags: z.array(z.string().trim().min(1).max(100)).max(40),
  recommendedProductUrls: z.array(recommendedProductUrlSchema).max(12),
  sourceCandidateId: z.string().trim().min(1).max(200).nullable().optional(),
  publicationStatus: z.enum(["draft", "published", "archived"]),
  lastVerifiedAt: z.iso.date().nullable(),
  reviewAfter: z.iso.date().nullable(),
});

function admin(request: NextRequest) {
  const session = readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
  return session?.email && isAdminEmail(session.email) ? session : null;
}

function row(entry: z.infer<typeof entrySchema>, createdBy?: string | null) {
  const now = new Date().toISOString();
  return {
    question: entry.question,
    answer: entry.answer,
    category: entry.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    summary: entry.summary || entry.answer.split(/(?<=[.!?])\s/)[0]?.slice(0, 500) || entry.answer.slice(0, 500),
    follow_up_questions: entry.followUpQuestions,
    safety_notes: entry.safetyNotes,
    tags: [...new Set(entry.tags.map((tag) => tag.toLowerCase()))],
    relevant_product_tags: [...new Set(entry.relevantProductTags.map((tag) => tag.toLowerCase()))],
    recommended_product_urls: [...new Set(entry.recommendedProductUrls)],
    source_candidate_id: entry.sourceCandidateId || null,
    publication_status: entry.publicationStatus,
    enabled: entry.publicationStatus === "published",
    last_verified_at: entry.lastVerifiedAt,
    review_after: entry.reviewAfter,
    updated_by: createdBy || null,
    ...(createdBy ? { created_by: createdBy } : {}),
    updated_at: now,
  };
}

export async function GET(request: NextRequest) {
  if (!admin(request)) return Response.json({ error: "Admin access required" }, { status: 403 });
  try {
    return Response.json({ entries: await listManagedKnowledgeEntries() });
  } catch (error) {
    console.error("[admin-knowledge] list failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Run the knowledge_entries Supabase migration before using the editor" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = admin(request);
  if (!session) return Response.json({ error: "Admin access required" }, { status: 403 });
  const parsed = entrySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Please check the required knowledge fields" }, { status: 400 });
  try {
    const { error } = await getServerSupabaseClient().from("knowledge_entries").insert(row(parsed.data, session.email));
    if (error) throw new Error(error.message);
    return Response.json({ entries: await listManagedKnowledgeEntries() });
  } catch (error) {
    console.error("[admin-knowledge] create failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Knowledge entry could not be created" }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = admin(request);
  if (!session) return Response.json({ error: "Admin access required" }, { status: 403 });
  const parsed = z.object({ id: idSchema, entry: entrySchema }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Please check the required knowledge fields" }, { status: 400 });
  try {
    const { error } = await getServerSupabaseClient()
      .from("knowledge_entries")
      .update(row(parsed.data.entry, session.email))
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    return Response.json({ entries: await listManagedKnowledgeEntries() });
  } catch (error) {
    console.error("[admin-knowledge] update failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Knowledge entry could not be updated" }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!admin(request)) return Response.json({ error: "Admin access required" }, { status: 403 });
  const parsedId = idSchema.safeParse(request.nextUrl.searchParams.get("id"));
  if (!parsedId.success) return Response.json({ error: "Invalid knowledge entry ID" }, { status: 400 });
  try {
    const { error } = await getServerSupabaseClient().from("knowledge_entries").delete().eq("id", parsedId.data);
    if (error) throw new Error(error.message);
    return Response.json({ entries: await listManagedKnowledgeEntries() });
  } catch (error) {
    console.error("[admin-knowledge] delete failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Knowledge entry could not be deleted" }, { status: 503 });
  }
}
