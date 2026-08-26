import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { serverConfig } from "@/config/env";
import { getServerSupabaseClient } from "@/services/supabase/server";
import { formatConversationTranscript } from "./contact-transcript";
import type { Conversation } from "@/types";

interface ContactTeamInput {
  shopifyCustomerId: string;
  customerEmail: string;
  customerName: string;
  customerMessage: string;
  conversation: Conversation;
}

export class ContactTeamRateLimitError extends Error {
  constructor() {
    super("Contact enquiry daily limit reached");
    this.name = "ContactTeamRateLimitError";
  }
}

export function contactTeamConfigured() {
  return Boolean(serverConfig.resendApiKey && serverConfig.resendFromEmail && serverConfig.contactTeamToEmail);
}

function enquiryKey(input: ContactTeamInput) {
  return createHash("sha256").update([
    input.shopifyCustomerId,
    input.conversation.id,
    input.conversation.updatedAt,
    input.customerMessage,
  ].join("\n")).digest("hex");
}

export async function sendContactTeamEnquiry(input: ContactTeamInput) {
  if (!contactTeamConfigured()) throw new Error("Team contact email is not configured");
  const supabase = getServerSupabaseClient();
  let id: string = randomUUID();
  const idempotencyKey = enquiryKey(input);
  const { data: existing } = await supabase
    .from("buddy_contact_enquiries")
    .select("id,status,sent_at,resend_email_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.status === "sent") {
    return { id: existing.id as string, sentAt: existing.sent_at as string | null, alreadySent: true };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("buddy_contact_enquiries")
    .select("id", { count: "exact", head: true })
    .eq("shopify_customer_id", input.shopifyCustomerId)
    .gte("created_at", since);
  if (countError) throw new Error(`Contact enquiry rate check failed: ${countError.message}`);
  if ((count ?? 0) >= 3 && !existing) throw new ContactTeamRateLimitError();

  const { error: insertError } = await supabase.from("buddy_contact_enquiries").insert({
    id,
    shopify_customer_id: input.shopifyCustomerId,
    customer_email: input.customerEmail,
    conversation_id: input.conversation.id,
    conversation_title: input.conversation.title,
    customer_message: input.customerMessage,
    message_count: input.conversation.messages.length,
    status: "sending",
    idempotency_key: idempotencyKey,
  });

  if (insertError) {
    if (!existing) throw new Error(`Contact enquiry could not be reserved: ${insertError.message}`);
    id = existing.id as string;
    const { error: retryError } = await supabase.from("buddy_contact_enquiries").update({
      status: "sending",
      error_message: null,
    }).eq("id", id);
    if (retryError) throw new Error(`Contact enquiry retry could not be reserved: ${retryError.message}`);
  }

  const customerName = input.customerName.trim() || "All Good Petfood customer";
  const transcript = formatConversationTranscript(input.conversation);
  const text = [
    "A signed-in customer has asked the All Good Petfood team to continue helping after a Buddy conversation.",
    "",
    `Customer: ${customerName}`,
    `Customer email: ${input.customerEmail}`,
    `Conversation: ${input.conversation.title}`,
    "",
    "Message to the team:",
    input.customerMessage,
    "",
    "The complete Buddy conversation is attached as a text file.",
    "Reply directly to this email to respond to the customer.",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverConfig.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `buddy-contact/${idempotencyKey}`,
        "User-Agent": "MyPetHealth-Buddy/1.0",
      },
      body: JSON.stringify({
        from: serverConfig.resendFromEmail,
        to: [serverConfig.contactTeamToEmail],
        reply_to: input.customerEmail,
        subject: `Buddy conversation: ${input.conversation.title}`.slice(0, 180),
        text,
        attachments: [{
          filename: `buddy-conversation-${input.conversation.id}.txt`,
          content: Buffer.from(transcript, "utf8").toString("base64"),
        }],
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !result.id) throw new Error(result.message || `Resend returned ${response.status}`);

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase.from("buddy_contact_enquiries").update({
      status: "sent",
      sent_at: sentAt,
      resend_email_id: result.id,
      error_message: null,
    }).eq("id", id);
    if (updateError) console.error("[contact-team] email sent but audit update failed", updateError.message);
    return { id, sentAt, alreadySent: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    await supabase.from("buddy_contact_enquiries").update({
      status: "failed",
      error_message: message.slice(0, 1000),
    }).eq("id", id);
    throw error;
  }
}
