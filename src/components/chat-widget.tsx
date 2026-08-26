"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUp, Clock3, ExternalLink, Heart, Menu, MessageCircleMore, Pencil, Plus, ShieldCheck, ShoppingBag, Trash2, X } from "lucide-react";
import { ShopifyAccountControl, type ShopifyCustomer } from "./shopify-account-control";
import { AllGoodLogo, BrandMark, BuddyLogo } from "./brand-mark";
import { ProductCard } from "./product-card";
import { conversationStore } from "@/services/conversations/local-storage-store";
import { apiConversationStore } from "@/services/conversations/api-conversation-store";
import type { ChatMessage, Conversation, CustomerPet, ProductRecommendation } from "@/types";

const WELCOME = "I’m Buddy, All Good Petfood’s Pet Health and Shop Assistant. How can I help?";
const QUICK_PROMPTS = ["My pet is itchy", "Sensitive stomach", "How much should I feed?", "Help me choose a product", "Promotions"];

const ON_SALE_URL = "https://allgoodpetfood.co.nz/collections/on-sale";

interface LatestNewsletter {
  title: string;
  url: string;
  publishedAt: string;
  description: string | null;
  imageUrl: string | null;
}

interface PetDraft {
  name: string;
  species: "" | "dog" | "cat";
  breed: string;
  ageValue: string;
  ageUnit: "weeks" | "months" | "years";
  weightKg: string;
  currentFoodTitle: string;
  knownSensitivities: string;
  status: CustomerPet["status"];
}

const EMPTY_PET: PetDraft = {
  name: "",
  species: "",
  breed: "",
  ageValue: "",
  ageUnit: "years",
  weightKg: "",
  currentFoodTitle: "",
  knownSensitivities: "",
  status: "active",
};

function petDraft(pet?: CustomerPet): PetDraft {
  if (!pet) return { ...EMPTY_PET };
  return {
    name: pet.name,
    species: pet.species ?? "",
    breed: pet.breed ?? "",
    ageValue: pet.ageValue === null ? "" : String(pet.ageValue),
    ageUnit: pet.ageUnit ?? "years",
    weightKg: pet.weightKg === null ? "" : String(pet.weightKg),
    currentFoodTitle: pet.currentFoodTitle ?? "",
    knownSensitivities: pet.knownSensitivities.join(", "),
    status: pet.status,
  };
}

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

function welcomeMessage(name = "", pets: CustomerPet[] = []): ChatMessage {
  const activeNames = pets.filter((pet) => pet.status === "active").map((pet) => pet.name);
  const petGreeting = activeNames.length === 1
    ? ` How is ${activeNames[0]} doing today?`
    : activeNames.length === 2
      ? ` How are ${activeNames[0]} and ${activeNames[1]} doing today?`
      : activeNames.length > 2 ? " How are your pets doing today?" : "";
  const greeting = `${name ? `Hi ${name},` : "Hi,"} ${WELCOME}${petGreeting}`;
  return { id: id(), role: "assistant", content: greeting, createdAt: new Date().toISOString() };
}

function createConversation(name = "", pets: CustomerPet[] = []): Conversation {
  const now = new Date().toISOString();
  return { id: id(), title: "New conversation", createdAt: now, updatedAt: now, messages: [welcomeMessage(name, pets)] };
}

export function ChatWidget() {
  const [conversation, setConversation] = useState<Conversation>(() => createConversation());
  const [history, setHistory] = useState<Conversation[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Record<string, ProductRecommendation[]>>({});
  const [shopifyCustomer, setShopifyCustomer] = useState<ShopifyCustomer | null>(null);
  const [customerPets, setCustomerPets] = useState<CustomerPet[]>([]);
  const [editingPetId, setEditingPetId] = useState<"new" | string | null>(null);
  const [petForm, setPetForm] = useState<PetDraft>(EMPTY_PET);
  const [petFormError, setPetFormError] = useState("");
  const [petFormSaving, setPetFormSaving] = useState(false);
  const [shopifyAuthState, setShopifyAuthState] = useState<"checking" | "authenticated" | "guest">("checking");
  const [storageNotice, setStorageNotice] = useState("");
  const [specialsOpen, setSpecialsOpen] = useState(false);
  const [newsletter, setNewsletter] = useState<LatestNewsletter | null>(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterError, setNewsletterError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    void fetch("/api/auth/shopify/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ authenticated: boolean; customer: ShopifyCustomer | null; pets?: CustomerPet[] }>)
      .then((result) => {
        if (!result.authenticated || !result.customer) {
          setShopifyAuthState("guest");
          // Buddy cannot read Shopify's cookie across domains. Ask Shopify to
          // reuse it silently; if it is absent, the callback redirects to the
          // All Good Petfood login rather than presenting a second login here.
          if (!new URLSearchParams(window.location.search).has("auth_error")) {
            window.location.replace("/api/auth/shopify/start?silent=1");
          }
          return;
        }
        setShopifyCustomer(result.customer);
        setCustomerPets(result.pets ?? []);
        setShopifyAuthState("authenticated");
        const name = result.customer.firstName?.trim()
          || result.customer.email?.split("@")[0]?.replace(/[._-]+/g, " ").split(/\s+/)[0]
          || "";
        setConversation((current) => {
          const isUntouched = current.title === "New conversation" && !current.messages.some((message) => message.role === "user");
          return isUntouched ? createConversation(name, result.pets ?? []) : current;
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

  useEffect(() => {
    if (!specialsOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSpecialsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [specialsOpen]);

  const hasCustomerMessage = useMemo(() => conversation.messages.some((message) => message.role === "user"), [conversation.messages]);

  async function persist(next: Conversation) {
    const normalized = normalizeConversation(next);
    // Keep the sidebar responsive even if the cloud request is slow or fails.
    setHistory((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    try {
      await apiConversationStore.save(normalized);
      const cloudItems = await apiConversationStore.list();
      setHistory(() => {
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
      const customerName = shopifyCustomer?.firstName?.trim()
        || shopifyCustomer?.email?.split("@")[0]?.replace(/[._-]+/g, " ").split(/\s+/)[0]
        || "";
      const fallback = remaining[0] ?? createConversation(customerName, customerPets);
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
      const data = (await response.json()) as { message?: string; products?: ProductRecommendation[]; resetProductContext?: boolean; pets?: CustomerPet[]; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || "No response received");
      if (data.pets) setCustomerPets(data.pets);

      const assistantMessage: ChatMessage = {
        id: id(),
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
        productIds: data.resetProductContext
          ? undefined
          : data.products?.length
          ? data.products.map(({ product }) => product.id)
          : [...messages].reverse().find((message) => message.role === "assistant")?.productIds,
        products: data.products ?? [],
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
    setConversation(createConversation(shopifyName, customerPets));
    setRecommendations({});
    setSidebarOpen(false);
    setInput("");
  }

  function openPetEditor(pet?: CustomerPet) {
    setEditingPetId(pet?.id ?? "new");
    setPetForm(petDraft(pet));
    setPetFormError("");
  }

  async function savePetProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!petForm.name.trim() || petFormSaving) return;
    setPetFormSaving(true);
    setPetFormError("");
    const pet = {
      name: petForm.name.trim(),
      species: petForm.species || null,
      breed: petForm.breed.trim() || null,
      ageValue: petForm.ageValue === "" ? null : Number(petForm.ageValue),
      ageUnit: petForm.ageValue === "" ? null : petForm.ageUnit,
      weightKg: petForm.weightKg === "" ? null : Number(petForm.weightKg),
      currentFoodTitle: petForm.currentFoodTitle.trim() || null,
      knownSensitivities: petForm.knownSensitivities.split(",").map((value) => value.trim()).filter(Boolean),
      status: petForm.status,
    };
    try {
      const isNew = editingPetId === "new";
      const response = await fetch("/api/pets", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? pet : { id: editingPetId, pet }),
      });
      const data = await response.json() as { pets?: CustomerPet[]; error?: string };
      if (!response.ok || !data.pets) throw new Error(data.error || "Pet profile could not be saved");
      setCustomerPets(data.pets);
      setEditingPetId(null);
    } catch (error) {
      setPetFormError(error instanceof Error ? error.message : "Pet profile could not be saved");
    } finally {
      setPetFormSaving(false);
    }
  }

  async function deletePetProfile(pet: CustomerPet) {
    if (!window.confirm(`Permanently delete ${pet.name}’s profile?`)) return;
    try {
      const response = await fetch(`/api/pets?id=${encodeURIComponent(pet.id)}`, { method: "DELETE" });
      const data = await response.json() as { pets?: CustomerPet[]; error?: string };
      if (!response.ok || !data.pets) throw new Error(data.error || "Pet profile could not be deleted");
      setCustomerPets(data.pets);
      if (editingPetId === pet.id) setEditingPetId(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Pet profile could not be deleted");
    }
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

  async function openSpecials() {
    setSpecialsOpen(true);
    if (newsletter || newsletterLoading) return;
    setNewsletterLoading(true);
    setNewsletterError("");
    try {
      const response = await fetch("/api/shopify/latest-newsletter");
      const data = await response.json() as { newsletter?: LatestNewsletter; error?: string };
      if (!response.ok || !data.newsletter) throw new Error(data.error || "Newsletter unavailable");
      setNewsletter(data.newsletter);
    } catch {
      setNewsletterError("The newsletter preview is temporarily unavailable, but you can still shop all current sale products.");
    } finally {
      setNewsletterLoading(false);
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
              <h1>Continue through All Good Petfood</h1>
              <p>Buddy uses your All Good Petfood customer account. Sign in or create an account on the store, then open Chat with Buddy again.</p>
              <a className="access-primary" href="https://allgoodpetfood.co.nz/account/login">Sign in at All Good Petfood</a>
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
        <section className="pets-block" aria-labelledby="my-pets-heading">
          <div className="pets-label">
            <span id="my-pets-heading"><Heart size={14} /> My pets</span>
            <button type="button" onClick={() => openPetEditor()} aria-label="Add a pet"><Plus size={14} /> Add</button>
          </div>
          {customerPets.length === 0 ? (
            <button type="button" className="empty-pets" onClick={() => openPetEditor()}>
              Add a pet so Buddy can remember them.
            </button>
          ) : (
            <div className="pets-list">
              {customerPets.map((pet) => (
                <div key={pet.id} className={`pet-item ${pet.status !== "active" ? "inactive" : ""}`}>
                  <button type="button" className="pet-open" onClick={() => openPetEditor(pet)}>
                    <span>{pet.name}</span>
                    <small>{[pet.breed, pet.species, pet.status !== "active" ? pet.status : null].filter(Boolean).join(" · ") || "Profile"}</small>
                  </button>
                  <button type="button" className="pet-edit" onClick={() => openPetEditor(pet)} aria-label={`Edit ${pet.name}`}><Pencil size={12} /></button>
                  <button type="button" className="pet-delete" onClick={() => void deletePetProfile(pet)} aria-label={`Delete ${pet.name}`}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
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
        <a className="admin-link" href="/admin">Admin</a>
      </aside>

      {editingPetId && (
        <div className="pet-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !petFormSaving) setEditingPetId(null);
        }}>
          <section className="pet-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-dialog-title">
            <button type="button" className="pet-dialog-close" onClick={() => setEditingPetId(null)} aria-label="Close pet profile"><X size={18} /></button>
            <p className="pet-dialog-kicker">Buddy’s memory</p>
            <h2 id="pet-dialog-title">{editingPetId === "new" ? "Add a pet" : `Update ${petForm.name}`}</h2>
            <p>Only save details you want Buddy to remember and use in future chats.</p>
            <form className="pet-form" onSubmit={savePetProfile}>
              <label>Name<input required maxLength={80} value={petForm.name} onChange={(event) => setPetForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Pet type<select value={petForm.species} onChange={(event) => setPetForm((current) => ({ ...current, species: event.target.value as PetDraft["species"] }))}><option value="">Not specified</option><option value="dog">Dog</option><option value="cat">Cat</option></select></label>
              <label className="pet-form-wide">Breed<input maxLength={120} value={petForm.breed} onChange={(event) => setPetForm((current) => ({ ...current, breed: event.target.value }))} placeholder="e.g. Staffy" /></label>
              <label>Age<input type="number" min="0" max="100" step="0.1" value={petForm.ageValue} onChange={(event) => setPetForm((current) => ({ ...current, ageValue: event.target.value }))} /></label>
              <label>Age unit<select value={petForm.ageUnit} onChange={(event) => setPetForm((current) => ({ ...current, ageUnit: event.target.value as PetDraft["ageUnit"] }))}><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select></label>
              <label>Weight (kg)<input type="number" min="0.1" max="500" step="0.1" value={petForm.weightKg} onChange={(event) => setPetForm((current) => ({ ...current, weightKg: event.target.value }))} /></label>
              <label>Status<select value={petForm.status} onChange={(event) => setPetForm((current) => ({ ...current, status: event.target.value as CustomerPet["status"] }))}><option value="active">Active</option><option value="deceased">Passed away</option><option value="archived">Archived</option></select></label>
              <label className="pet-form-wide">Current food<input maxLength={500} value={petForm.currentFoodTitle} onChange={(event) => setPetForm((current) => ({ ...current, currentFoodTitle: event.target.value }))} placeholder="Brand and recipe, if known" /></label>
              <label className="pet-form-wide">Sensitivities<input value={petForm.knownSensitivities} onChange={(event) => setPetForm((current) => ({ ...current, knownSensitivities: event.target.value }))} placeholder="Chicken, grain (separate with commas)" /></label>
              {petForm.status === "deceased" && <p className="pet-status-note">Buddy will retain this profile but will not mention this pet in greetings or make sales suggestions for them.</p>}
              {petFormError && <p className="pet-form-error" role="alert">{petFormError}</p>}
              <div className="pet-form-actions"><button type="button" onClick={() => setEditingPetId(null)} disabled={petFormSaving}>Cancel</button><button type="submit" disabled={petFormSaving || !petForm.name.trim()}>{petFormSaving ? "Saving…" : "Save pet"}</button></div>
            </form>
          </section>
        </div>
      )}

      {specialsOpen && (
        <div className="specials-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSpecialsOpen(false);
        }}>
          <section className="specials-dialog" role="dialog" aria-modal="true" aria-labelledby="specials-dialog-title">
            <button type="button" className="specials-close" onClick={() => setSpecialsOpen(false)} aria-label="Close promotions"><X size={19} /></button>
            <span className="specials-kicker">All Good Petfood</span>
            <h2 id="specials-dialog-title">Promotions</h2>
            {newsletterLoading ? (
              <p className="specials-loading">Loading the latest newsletter&hellip;</p>
            ) : newsletter ? (
              <article className="newsletter-preview">
                {newsletter.imageUrl && <Image src={newsletter.imageUrl} alt="" width={720} height={360} sizes="(max-width: 600px) 90vw, 520px" />}
                <div>
                  <span>Latest newsletter &middot; {new Date(newsletter.publishedAt).toLocaleDateString("en-NZ", { month: "long", year: "numeric" })}</span>
                  <h3>{newsletter.title}</h3>
                  {newsletter.description && <p>{newsletter.description}</p>}
                  <a href={newsletter.url} target="_blank" rel="noopener">Read current newsletter <ExternalLink size={15} /></a>
                </div>
              </article>
            ) : (
              <p className="specials-error">{newsletterError}</p>
            )}
            <a className="sale-products-button" href={ON_SALE_URL} target="_blank" rel="noopener"><ShoppingBag size={17} /> Shop all sale products</a>
            <small>Products, prices and availability are shown live by All Good Petfood.</small>
          </section>
        </div>
      )}

      <main className="chat-main">
        <header className="chat-header">
          <button className="icon-button mobile-only" aria-label="Open conversation menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <a className="header-back" href="https://allgoodpetfood.co.nz">Back to All Good Petfood</a>
          <AllGoodLogo />
          <div className="guide-status"><span className="status-avatar"><Image className="buddy-avatar-image" src="/brand/buddy-paw.png" alt="" width={311} height={271} sizes="28px" /></span><span><strong>Buddy</strong><small><i /> All Good Petfood assistant</small></span></div>
          {shopifyCustomer && <ShopifyAccountControl customer={shopifyCustomer} />}
        </header>

        <section className="conversation" aria-live="polite">
          <div className="conversation-inner">
            <div className="day-divider"><span>Today</span></div>
            {conversation.messages.map((message, index) => (
              <div key={message.id} className={`message-row ${message.role} ${index === 0 ? "welcome-message" : ""}`}>
                {message.role === "assistant" && <span className="assistant-avatar"><Image className="buddy-avatar-image" src="/brand/buddy-paw.png" alt="" width={311} height={271} sizes="24px" /></span>}
                <div className="message-stack">
                  <div className="message-bubble">
                    {message.content.split("\n").map((paragraph, paragraphIndex) => paragraph && <p key={paragraphIndex}>{paragraph}</p>)}
                  </div>
                  {index === 0 && !hasCustomerMessage && (
                    <div className="quick-prompts">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button key={prompt} onClick={() => prompt === "Promotions" ? void openSpecials() : void sendMessage(prompt)}>{prompt}</button>
                      ))}
                    </div>
                  )}
                  {(message.products ?? recommendations[message.id] ?? []).map((recommendation) => <ProductCard key={recommendation.product.id} recommendation={recommendation} />)}
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
