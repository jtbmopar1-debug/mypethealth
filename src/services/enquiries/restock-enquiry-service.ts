import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { serverConfig } from "@/config/env";
import { getServerSupabaseClient } from "@/services/supabase/server";
import type { Product } from "@/types";

interface RestockEnquiryInput {
  shopifyCustomerId: string;
  customerEmail: string;
  customerName: string;
  product: Product;
  question: string;
}

interface ExistingEnquiry {
  id: string;
  status: "sending" | "sent" | "failed";
  sent_at: string | null;
  resend_email_id: string | null;
}

export function restockEnquiryConfigured() {
  return Boolean(serverConfig.resendApiKey && serverConfig.resendFromEmail && serverConfig.restockEnquiryToEmail);
}

export async function getLatestRestockEnquiry(shopifyCustomerId: string, productId?: string) {
  let query = getServerSupabaseClient()
    .from("restock_enquiries")
    .select("id,product_title,status,sent_at,created_at")
    .eq("shopify_customer_id", shopifyCustomerId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (productId) query = query.eq("product_id", productId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Stock enquiry history lookup failed: ${error.message}`);
  return data as { id: string; product_title: string; status: "sending" | "sent" | "failed"; sent_at: string | null; created_at: string } | null;
}

function enquiryKey(customerId: string, productId: string) {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${customerId}\n${productId}\n${day}`).digest("hex");
}

export async function sendRestockEnquiry(input: RestockEnquiryInput) {
  if (!restockEnquiryConfigured()) throw new Error("Stock enquiry email is not configured");
  const supabase = getServerSupabaseClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("restock_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("shopify_customer_id", input.shopifyCustomerId)
    .gte("created_at", since);
  if (countError) throw new Error(`Stock enquiry rate check failed: ${countError.message}`);
  if ((count ?? 0) >= 3) throw new Error("Stock enquiry daily limit reached");

  let id = randomUUID();
  const idempotencyKey = enquiryKey(input.shopifyCustomerId, input.product.id);
  const { error: insertError } = await supabase.from("restock_enquiries").insert({
    id,
    shopify_customer_id: input.shopifyCustomerId,
    customer_email: input.customerEmail,
    product_id: input.product.id,
    product_title: input.product.title,
    product_url: input.product.url,
    customer_question: input.question.slice(0, 4000),
    status: "sending",
    idempotency_key: idempotencyKey,
  });

  if (insertError) {
    const { data: existing } = await supabase
      .from("restock_enquiries")
      .select("id,status,sent_at,resend_email_id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing?.status === "sent") {
      const sent = existing as ExistingEnquiry;
      return { id: sent.id, sentAt: sent.sent_at, resendEmailId: sent.resend_email_id, alreadySent: true };
    }
    if (!existing) throw new Error(`Stock enquiry could not be reserved: ${insertError.message}`);
    id = existing.id;
    const { error: retryError } = await supabase.from("restock_enquiries").update({
      status: "sending",
      error_message: null,
    }).eq("id", id);
    if (retryError) throw new Error(`Stock enquiry retry could not be reserved: ${retryError.message}`);
  }

  const customerName = input.customerName.trim() || "All Good Petfood customer";
  const text = [
    "A signed-in My Pet Health customer has asked about an out-of-stock product.",
    "",
    `Customer: ${customerName}`,
    `Customer email: ${input.customerEmail}`,
    `Product: ${input.product.title}`,
    `Product URL: ${input.product.url}`,
    "",
    "Customer question:",
    input.question,
    "",
    "Please reply directly to this email; Reply-To is set to the customer.",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverConfig.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `restock-enquiry/${idempotencyKey}`,
        "User-Agent": "MyPetHealth-Buddy/1.0",
      },
      body: JSON.stringify({
        from: serverConfig.resendFromEmail,
        to: [serverConfig.restockEnquiryToEmail],
        reply_to: input.customerEmail,
        subject: `Stock enquiry: ${input.product.title}`.slice(0, 180),
        text,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !result.id) throw new Error(result.message || `Resend returned ${response.status}`);
    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("restock_enquiries").update({
      status: "sent",
      sent_at: sentAt,
      resend_email_id: result.id,
      error_message: null,
    }).eq("id", id);
    if (updateError) {
      console.error("[restock-enquiry] email sent but audit update failed", updateError.message);
    }
    return { id, sentAt, resendEmailId: result.id, alreadySent: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    await supabase.from("restock_enquiries").update({ status: "failed", error_message: message.slice(0, 1000) }).eq("id", id);
    throw error;
  }
}
