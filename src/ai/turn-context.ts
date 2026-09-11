import type { ChatMessage } from "@/types";

export interface TurnContext {
  continuing: boolean;
  answeringQuestion: boolean;
  pendingQuestion: string;
  productIds: string[];
  knowledgeQuery: string;
}

// Conversation state is independent of whether this turn renders a new card.
export function resolveTurn(messages: Pick<ChatMessage, "role" | "content" | "productIds">[]): TurnContext {
  const latest = messages.at(-1)?.content ?? "";
  const previous = messages.slice(0, -1).findLast((m) => m.role === "assistant");
  const priorQuestion = messages.slice(0, -1).findLast((m) => m.role === "user")?.content ?? "";
  const pendingQuestion = previous?.content.match(/[^.!?]*\?/g)?.slice(-2).join(" ").trim() ?? "";
  const newSubject = /\b(?:new question|different (?:question|topic|pet)|unrelated|instead|do you (?:sell|stock|carry)|show me|looking for)\b/i.test(latest);
  const reference = /\b(?:this|that|these|those|it|they|them|he|she|his|her)\b/i.test(latest);
  const details = /\b(?:\d+(?:\.\d+)?\s*(?:yrs?|years?|months?|weeks?|yo|kg)|small|medium|large|none|no allergies|no sensitivities)\b/i.test(latest);
  const shortAnswer = !latest.includes("?") && latest.split(/\s+/).length <= 30;
  const answeringQuestion = Boolean(pendingQuestion) && !newSubject && (details || shortAnswer);
  const continuing = !newSubject && (answeringQuestion || reference || /^(?:yes|no|thanks|okay|ok|retry|try again|please retry)\b/i.test(latest));
  return {
    continuing,
    answeringQuestion,
    pendingQuestion: answeringQuestion ? pendingQuestion : "",
    productIds: continuing ? previous?.productIds ?? [] : [],
    knowledgeQuery: answeringQuestion ? `${priorQuestion} ${latest}` : latest,
  };
}
