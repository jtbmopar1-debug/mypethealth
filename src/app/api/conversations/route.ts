import type { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

// These values are primary keys in Supabase, so keep the API contract aligned
// with the database instead of accepting IDs that will fail at upsert time.
const idSchema = z.string().uuid();
const productSchema = z.object({
  id: z.string().min(1).max(200),
  variantId: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(20000),
  ingredients: z.array(z.string().max(500)).max(100),
  price: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  currency: z.literal("NZD"),
  image: z.string().max(3000),
  url: z.string().max(3000),
  retailer: z.string().max(200),
  tags: z.array(z.string().max(300)).max(200),
  availability: z.enum(["in_stock", "out_of_stock"]),
});
const recommendationSchema = z.object({
  product: productSchema,
  reason: z.string().max(2000),
});
const messageSchema = z.object({
  id: idSchema,
  role: z.enum(["user", "assistant"]),
  // User input is capped at 4,000 characters, but a generated assistant
  // response can be longer. Keep the persisted shape aligned with the chat
  // response limit instead of rejecting an otherwise valid conversation.
  content: z.string().min(1).max(12000),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp"),
  productIds: z.array(z.string().max(200)).max(20).optional(),
  products: z.array(recommendationSchema).max(10).optional(),
});
const conversationSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(120),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp"),
  updatedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp"),
  messages: z.array(messageSchema).min(1).max(100),
  petProfile: z.record(z.string(), z.unknown()).optional(),
});

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: z.infer<typeof messageSchema>[];
  pet_profile: Record<string, unknown> | null;
}

function customer(request: NextRequest) {
  return readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
}

function fromRow(row: ConversationRow) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: row.messages,
    petProfile: row.pet_profile ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });

  const requestedId = request.nextUrl.searchParams.get("id");
  const parsedId = requestedId ? idSchema.safeParse(requestedId) : null;
  if (parsedId && !parsedId.success) return Response.json({ error: "Invalid conversation ID" }, { status: 400 });

  const supabase = getServerSupabaseClient();
  let query = supabase
    .from("shopify_conversations")
    .select("id,title,created_at,updated_at,messages,pet_profile")
    .eq("shopify_customer_id", session.customerId)
    .order("updated_at", { ascending: false });
  if (parsedId?.success) query = query.eq("id", parsedId.data).limit(1);

  const { data, error } = await query;
  if (error) return Response.json({ error: "Cloud chat storage is unavailable" }, { status: 503 });
  const conversations = (data as ConversationRow[]).map(fromRow);
  return parsedId?.success
    ? Response.json({ conversation: conversations[0] ?? null })
    : Response.json({ conversations });
}

export async function PUT(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });

  const parsed = z.object({ conversation: conversationSchema }).safeParse(await request.json());
  if (!parsed.success) {
    console.warn("[conversations] invalid save payload", parsed.error.issues.map(({ path, code }) => ({ path, code })));
    return Response.json({ error: "Invalid conversation" }, { status: 400 });
  }
  const conversation = parsed.data.conversation;
  const { error } = await getServerSupabaseClient().from("shopify_conversations").upsert({
    id: conversation.id,
    shopify_customer_id: session.customerId,
    title: conversation.title,
    messages: conversation.messages,
    pet_profile: conversation.petProfile ?? null,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
  }, { onConflict: "id,shopify_customer_id" });
  if (error) return Response.json({ error: "Cloud chat could not be saved" }, { status: 503 });
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });

  const requestedId = request.nextUrl.searchParams.get("id");
  const parsedId = requestedId ? idSchema.safeParse(requestedId) : null;
  if (parsedId && !parsedId.success) return Response.json({ error: "Invalid conversation ID" }, { status: 400 });

  let query = getServerSupabaseClient()
    .from("shopify_conversations")
    .delete()
    .eq("shopify_customer_id", session.customerId);
  if (parsedId?.success) query = query.eq("id", parsedId.data);
  const { error } = await query;
  if (error) return Response.json({ error: "Cloud chat could not be deleted" }, { status: 503 });
  return Response.json({ ok: true });
}
