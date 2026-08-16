"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Clock3, Menu, MessageCircleMore, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { ProductCard } from "./product-card";
import { conversationStore } from "@/services/conversations/local-storage-store";
import type { ChatMessage, Conversation, ProductRecommendation } from "@/types";

const WELCOME = "Hi, I’m the My Pet Health guide. Tell me a little about your dog and what you’d like help with — we’ll work it out together.";
const QUICK_PROMPTS = ["My dog is itchy", "Sensitive stomach", "How much should I feed?", "Help me choose a protein"];

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function welcomeMessage(): ChatMessage {
  return { id: id(), role: "assistant", content: WELCOME, createdAt: new Date().toISOString() };
}

function createConversation(): Conversation {
  const now = new Date().toISOString();
  return { id: id(), title: "New conversation", createdAt: now, updatedAt: now, messages: [welcomeMessage()] };
}

export function ChatWidget() {
  const [conversation, setConversation] = useState<Conversation>(() => createConversation());
  const [history, setHistory] = useState<Conversation[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Record<string, ProductRecommendation[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    conversationStore.list().then(setHistory);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages, isLoading]);

  const hasCustomerMessage = useMemo(() => conversation.messages.some((message) => message.role === "user"), [conversation.messages]);

  async function persist(next: Conversation) {
    await conversationStore.save(next);
    setHistory(await conversationStore.list());
  }

  async function sendMessage(value = input) {
    const content = value.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = { id: id(), role: "user", content, createdAt: new Date().toISOString() };
    const messages = [...conversation.messages, userMessage];
    const nextConversation: Conversation = {
      ...conversation,
      title: conversation.title === "New conversation" ? content.slice(0, 42) : conversation.title,
      updatedAt: new Date().toISOString(),
      messages
    };
    setConversation(nextConversation);
    setInput("");
    setIsLoading(true);
    await persist(nextConversation);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      const data = (await response.json()) as { message?: string; products?: ProductRecommendation[]; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || "No response received");

      const assistantMessage: ChatMessage = {
        id: id(),
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
        productIds: data.products?.map(({ product }) => product.id)
      };
      const completed = { ...nextConversation, updatedAt: new Date().toISOString(), messages: [...messages, assistantMessage] };
      setRecommendations((current) => ({ ...current, [assistantMessage.id]: data.products ?? [] }));
      setConversation(completed);
      await persist(completed);
    } catch {
      const errorMessage: ChatMessage = {
        id: id(),
        role: "assistant",
        content: "I’m having a little trouble connecting right now. Your conversation is saved — please try that message again in a moment.",
        createdAt: new Date().toISOString()
      };
      const failed = { ...nextConversation, messages: [...messages, errorMessage] };
      setConversation(failed);
      await persist(failed);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function startNewConversation() {
    setConversation(createConversation());
    setRecommendations({});
    setSidebarOpen(false);
    setInput("");
  }

  async function openConversation(item: Conversation) {
    setConversation(item);
    setRecommendations({});
    setSidebarOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="chat-shell">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close conversation menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`chat-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <BrandMark />
          <button className="icon-button mobile-only" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        <button className="new-chat-button" onClick={startNewConversation}><Plus size={18} /> New conversation</button>
        <div className="history-block">
          <div className="history-label"><Clock3 size={14} /> Previous conversations</div>
          {history.length === 0 ? (
            <div className="empty-history"><MessageCircleMore size={23} /><p>Your saved chats will appear here.</p></div>
          ) : (
            <div className="history-list">
              {history.slice(0, 8).map((item) => (
                <button key={item.id} className={item.id === conversation.id ? "active" : ""} onClick={() => openConversation(item)}>
                  <span>{item.title}</span><small>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sidebar-note"><ShieldCheck size={18} /><span>Practical guidance, grounded in trusted pet-health knowledge.</span></div>
        <a className="admin-link" href="/admin">Staff admin preview →</a>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <button className="icon-button mobile-only" aria-label="Open conversation menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <BrandMark compact />
          <div className="guide-status"><span className="status-avatar"><Sparkles size={17} /></span><span><strong>My Pet Health guide</strong><small><i /> Here to help</small></span></div>
          <button className="header-new" onClick={startNewConversation}><Plus size={16} /> <span>New chat</span></button>
        </header>

        <section className="conversation" aria-live="polite">
          <div className="conversation-inner">
            <div className="day-divider"><span>Today</span></div>
            {conversation.messages.map((message, index) => (
              <div key={message.id} className={`message-row ${message.role}`}>
                {message.role === "assistant" && <span className="assistant-avatar"><Sparkles size={16} /></span>}
                <div className="message-stack">
                  <div className="message-bubble">
                    {message.content.split("\n").map((paragraph, paragraphIndex) => paragraph && <p key={paragraphIndex}>{paragraph}</p>)}
                  </div>
                  {index === 0 && !hasCustomerMessage && (
                    <div className="quick-prompts">
                      {QUICK_PROMPTS.map((prompt) => <button key={prompt} onClick={() => void sendMessage(prompt)}>{prompt}</button>)}
                    </div>
                  )}
                  {(recommendations[message.id] ?? []).map((recommendation) => <ProductCard key={recommendation.product.id} recommendation={recommendation} />)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-row assistant">
                <span className="assistant-avatar"><Sparkles size={16} /></span>
                <div className="typing" aria-label="My Pet Health is typing"><i /><i /><i /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </section>

        <footer className="composer-wrap">
          <form className="composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void sendMessage(); }}>
            <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={4000} placeholder="Ask about food, feeding, or your dog…" aria-label="Your message" />
            <button type="submit" className="send-button" disabled={!input.trim() || isLoading} aria-label="Send message"><ArrowUp size={20} /></button>
          </form>
          <p>General pet-food guidance only. For urgent or ongoing health concerns, talk with your vet.</p>
        </footer>
      </main>
    </div>
  );
}
