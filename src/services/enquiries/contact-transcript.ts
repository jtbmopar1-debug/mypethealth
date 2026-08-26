import type { Conversation } from "@/types";

export function formatConversationTranscript(conversation: Conversation) {
  const lines = [
    `Buddy conversation: ${conversation.title}`,
    `Conversation ID: ${conversation.id}`,
    `Started: ${conversation.createdAt}`,
    `Last updated: ${conversation.updatedAt}`,
    "",
  ];

  for (const message of conversation.messages) {
    lines.push(`[${message.createdAt}] ${message.role === "user" ? "Customer" : "Buddy"}`);
    lines.push(message.content);
    for (const recommendation of message.products ?? []) {
      lines.push(`Product shown: ${recommendation.product.title}`);
      lines.push(`Product URL: ${recommendation.product.url}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
