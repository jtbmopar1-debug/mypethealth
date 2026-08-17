import type { NextRequest } from "next/server";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

function customer(request: NextRequest) {
  return readShopifySessionOrLocalDev(request.cookies.get(SHOPIFY_SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });

  const supabase = getServerSupabaseClient();
  const [conversations, pets] = await Promise.all([
    supabase
      .from("shopify_conversations")
      .select("id,title,messages,pet_profile,created_at,updated_at")
      .eq("shopify_customer_id", session.customerId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("shopify_customer_pets")
      .select("id,name,species,breed,age_value,age_unit,age_recorded_at,weight_kg,current_food_title,known_sensitivities,status,deceased_at,created_at,updated_at,last_mentioned_at")
      .eq("shopify_customer_id", session.customerId)
      .order("last_mentioned_at", { ascending: false }),
  ]);

  if (conversations.error || pets.error) {
    console.error("[customer-data] export failed", conversations.error?.message || pets.error?.message);
    return Response.json({ error: "Buddy data could not be exported" }, { status: 503 });
  }

  return Response.json({
    exportedAt: new Date().toISOString(),
    customer: {
      shopifyCustomerId: session.customerId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
    },
    buddyData: {
      conversations: conversations.data,
      pets: pets.data,
    },
    note: "Shopify orders, payment details and addresses are not stored by Buddy and are not included in this export.",
  });
}

export async function DELETE(request: NextRequest) {
  const session = customer(request);
  if (!session) return Response.json({ error: "Shopify sign-in required" }, { status: 401 });

  const { error } = await getServerSupabaseClient().rpc("delete_buddy_customer_data", {
    target_customer_id: session.customerId,
  });
  if (error) {
    console.error("[customer-data] deletion failed", error.message);
    return Response.json({ error: "Buddy data could not be deleted" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
