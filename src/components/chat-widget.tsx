"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUp, Clock3, Menu, MessageCircleMore, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { ShopifyAccountControl, type ShopifyCustomer } from "./shopify-account-control";
import { BrandMark, BuddyLogo } from "./brand-mark";
import { ProductCard } from "./product-card";
import { conversationStore } from "@/services/conversations/local-storage-store";
import { apiConversationStore } from "@/services/conversations/api-conversation-store";
import type { ChatMessage, Conversation, ProductRecommendation } from "@/types";

const WELCOME = "I’m Buddy, your My Pet Health Assistant. Tell me a little about your pet or ask about anything you need help with — we’ll work it out together.";
const QUICK_PROMPTS = ["My pet is itchy", "Sensitive stomach", "How much should I feed?", "Help me choose a product"];

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeConversation(conversation: Conversation): Conversation {
  const fallbackNow = new Date().toISOString();
  const validTimestamp = (value: string | undefined) => {
    if (!value || Number.isNaN(Date.parse(value))) return fallbackNow;
    return new Date(value).toISOString();
  };
  return {
    ...conversation,
    id: isUuid(conversation.id) ? conversation.id : id(),
    createdAt: validTimestamp(conversation.createdAt),
    updatedAt: validTimestamp(conversation.updatedAt),
    messages: conversation.messages.map((message) => ({
      ...message,
      id: isUuid(message.id) ? message.id : id(),
      content: String(message.content ?? "").trim(),
      createdAt: validTimestamp(message.createdAt),
    })),
  };
}

function welcomeMessage(name = ""): ChatMessage {
  const greeting = name ? `Hi ${name}, ${WELCOME}` : `Hi, ${WELCOME}`;
  return { id: id(), role: "assistant", content: greeting, createdAt: new Date().toISOString() };
}

function createConversation(name = ""): Conversation {
  const now = new Date().toISOString();
  return { id: id(), title: "New conversation", createdAt: now, updatedAt: now, messages: [welcomeMessage(name)] };
}

export function ChatWidget() {
  const [conversation, setConversation] = useState<Conversation>(() => createConversation());
  const [history, setHistory] = useState<Conversation[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Record<string, ProductRecommendation[]>>({});
  const [shopifyCustomer, setShopifyCustomer] = useState<ShopifyCustomer | null>(null);
  const [shopifyAuthState, setShopifyAuthState] = useState<"checking" | "authenticated" | "guest">("checking");
  const [storageNotice, setStorageNotice] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    void fetch("/api/auth/shopify/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ authenticated: boolean; customer: ShopifyCustomer | null }>)
      .then((result) => {
        if (!result.authenticated || !result.customer) {
          setShopifyAuthState("guest");
          return;
        }
        setShopifyCustomer(result.customer);
        setShopifyAuthState("authenticated");
        const name = result.customer.firstName?.trim()
          || result.customer.email?.split("@")[0]?.replace(/[._-]+/g, " ").split(/\s+/)[0]
          || "";
        setConversation((current) => {
          const isUntouched = current.title === "New conversation" && !current.messages.some((message) => message.role === "user");
          return isUntouched ? createConversation(name) : current;
        });
      })
      .catch(() => {
        setShopifyCustomer(null);
        setShopifyAuthState("guest");
      });
  }, []);

  useEffect(() => {
    if (shopifyAuthState !== "authenticated") return;
    let cancelled = false;

    async function loadHistory() {
      try {
        const rawLocalConversations = await conversationStore.list();
        const localConversations = rawLocalConversations.map(normalizeConversation);

        // Persist repaired IDs before migrating to Supabase. Otherwise an old
        // local conversation gets a fresh random UUID on every remount and is
        // inserted as a duplicate each time the user returns to the chat.
        if (rawLocalConversations.length > 0) {
          await conversationStore.clear();
          for (const item of localConversations) await conversationStore.save(item);
        }

        for (const item of localConversations) await apiConversationStore.save(item);
        const items = await apiConversationStore.list();
        if (!cancelled) {
          setHistory(items.length > 0 ? items : localConversations);
          setStorageNotice("");
        }
      } catch {
        const localItems = (await conversationStore.list()).map(normalizeConversation);
        if (!cancelled) {
          setHistory(localItems);
          setStorageNotice("Cloud chat saving needs the Supabase database setup to be completed.");
        }
      }
    }

    void loadHistory();
    return () => { cancelled = true; };
  }, [shopifyAuthState]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages, isLoading]);

  const hasCustomerMessage = useMemo(() => conversation.messages.some((message) => message.role === "user"), [conversation.messages]);

  async function persist(next: Conversation) {
    const normalized = normalizeConversation(next);
    // Keep the sidebar responsive even if the cloud request is slow or fails.
    setHistory((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    try {
      await apiConversationStore.save(normalized);
      const cloudItems = await apiConversationStore.list();
      setHistory((current) => {
        const merged = [normalized, ...cloudItems.filter((item) => item.id !== normalized.id)];
        return merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
      setStorageNotice("");
    } catch {
      await conversationStore.save(normalized);
      setHistory(await conversationStore.list());
      setStorageNotice("This chat is saved on this device until cloud saving is available.");
    }
    return normalized;
  }

  async function deleteConversation(idToDelete: string) {
    if (!window.confirm("Delete this conversation?")) return;

    try {
      await apiConversationStore.remove(idToDelete);
    } catch {
      await conversationStore.remove(idToDelete);
    }

    const remaining = history.filter((item) => item.id !== idToDelete);
    setHistory(remaining);

    if (conversation.id === idToDelete) {
      const fallback = remaining[0] ?? createConversation(shopifyCustomer?.firstName?.trim()
        || shopifyCustomer?.email?.split("@")[0]?.replace(/[._-]+/g, " ").split(/\s+/)[0]
        || "");
      setConversation(fallback);
      setRecommendations({});
    }
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
    const persistedConversation = await persist(nextConversation);
    setConversation(persistedConversation);

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
      const persistedCompleted = await persist(completed);
      setConversation(persistedCompleted);
    } catch {
      const errorMessage: ChatMessage = {
        id: id(),
        role: "assistant",
        content: "I’m having a little trouble connecting right now. Your conversation is saved — please try that message again in a moment.",
        createdAt: new Date().toISOString()
      };
      const failed = { ...nextConversation, messages: [...messages, errorMessage] };
      setConversation(failed);
      const persistedFailed = await persist(failed);
      setConversation(persistedFailed);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function startNewConversation() {
    const shopifyName = shopifyCustomer?.firstName?.trim()
      || shopifyCustomer?.email?.split("@")[0]?.replace(/[._-]+/g, " ").split(/\s+/)[0]
      || "";
    setConversation(createConversation(shopifyName));
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

  if (shopifyAuthState !== "authenticated") {
    return (
      <main className="access-gate">
        <section className="access-card" aria-live="polite">
          <BrandMark />
          <BuddyLogo />
          {shopifyAuthState === "checking" ? (
            <>
              <h1>Checking your account…</h1>
              <p>Buddy is confirming your All Good Petfood sign-in.</p>
            </>
          ) : (
            <>
              <span className="eyebrow">All Good Petfood customer access</span>
              <h1>Sign in to chat with Buddy</h1>
              <p>My Pet Health is available to All Good Petfood customers. Sign in with your existing account, or create one securely through All Good Petfood.</p>
              <a className="access-primary" href="/api/auth/shopify/start">Sign In</a>
              <a className="access-secondary" href="https://allgoodpetfood.co.nz/account/register">Create Account</a>
              <a className="access-secondary" href="https://allgoodpetfood.co.nz">Return to All Good Petfood</a>
              <small>My Pet Health never receives your Shopify password.</small>
            </>
          )}
        </section>
      </main>
    );
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
                <div key={item.id} className={`history-item ${item.id === conversation.id ? "active" : ""}`}>
                  <button type="button" className="history-open" onClick={() => openConversation(item)}>
                    <span>{item.title}</span>
                    <small>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
                  </button>
                  <button
                    type="button"
                    className="history-delete"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => void deleteConversation(item.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
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
          <a className="header-back" href="https://allgoodpetfood.co.nz">Back to All Good Petfood</a>
          <BuddyLogo />
          <div className="guide-status"><span className="status-avatar"><Image className="buddy-avatar-image" src="/brand/buddy-paw.png" alt="" width={311} height={271} sizes="28px" /></span><span><strong>Buddy</strong><small><i /> My Pet Health guide</small></span></div>
          <button className="header-new" onClick={startNewConversation}><Plus size={16} /> <span>New chat</span></button>
          {shopifyCustomer && <ShopifyAccountControl customer={shopifyCustomer} />}
        </header>

        <section className="conversation" aria-live="polite">
          <div className="conversation-inner">
            <div className="day-divider"><span>Today</span></div>
            {conversation.messages.map((message, index) => (
              <div key={message.id} className={`message-row ${message.role}`}>
                {message.role === "assistant" && <span className="assistant-avatar"><Image className="buddy-avatar-image" src="/brand/buddy-paw.png" alt="" width={311} height={271} sizes="24px" /></span>}
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
                <span className="assistant-avatar"><Image className="buddy-avatar-image" src="/brand/buddy-paw.png" alt="" width={311} height={271} sizes="24px" /></span>
                <div className="typing" aria-label="Buddy is typing"><i /><i /><i /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </section>

        <footer className="composer-wrap">
          <form className="composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void sendMessage(); }}>
            <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={4000} placeholder="Ask about food, feeding, or your pet…" aria-label="Your message" />
            <button type="submit" className="send-button" disabled={!input.trim() || isLoading} aria-label="Send message"><ArrowUp size={20} /></button>
          </form>
          <p>{storageNotice || "General pet-food guidance only. For urgent or ongoing health concerns, talk with your vet."}</p>
        </footer>
      </main>
    </div>
  );
}
