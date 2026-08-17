"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, FilePenLine, Plus, Search, Tags, Trash2, X } from "lucide-react";
import type { KnowledgeEntry } from "@/types";

interface AdminKnowledgeEntry extends KnowledgeEntry {
  sourceCandidateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeReviewCandidate {
  id: string;
  question: string;
  answer: string;
  category: string;
  safetyNote: string;
  tags: string[];
}

interface EntryDraft {
  sourceCandidateId: string | null;
  question: string;
  answer: string;
  category: string;
  summary: string;
  followUpQuestions: string;
  safetyNotes: string;
  tags: string;
  relevantProductTags: string;
  recommendedProductUrls: string;
  enabled: boolean;
}

const EMPTY_ENTRY: EntryDraft = {
  sourceCandidateId: null,
  question: "",
  answer: "",
  category: "general",
  summary: "",
  followUpQuestions: "",
  safetyNotes: "",
  tags: "",
  relevantProductTags: "",
  recommendedProductUrls: "",
  enabled: true,
};

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function commaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function draftFromEntry(entry: AdminKnowledgeEntry): EntryDraft {
  return {
    sourceCandidateId: entry.sourceCandidateId,
    question: entry.title,
    answer: entry.content,
    category: entry.category,
    summary: entry.summary,
    followUpQuestions: entry.followUpQuestions.join("\n"),
    safetyNotes: entry.safetyNotes.join("\n"),
    tags: entry.tags.join(", "),
    relevantProductTags: entry.relevantProductTags.join(", "),
    recommendedProductUrls: (entry.recommendedProductUrls ?? []).join("\n"),
    enabled: entry.enabled,
  };
}

function payload(draft: EntryDraft) {
  return {
    question: draft.question.trim(),
    answer: draft.answer.trim(),
    category: draft.category.trim(),
    summary: draft.summary.trim() || null,
    followUpQuestions: lines(draft.followUpQuestions),
    safetyNotes: lines(draft.safetyNotes),
    tags: commaList(draft.tags),
    relevantProductTags: commaList(draft.relevantProductTags),
    recommendedProductUrls: lines(draft.recommendedProductUrls),
    sourceCandidateId: draft.sourceCandidateId,
    enabled: draft.enabled,
  };
}

export function AdminKnowledgeEditor({ builtInCount, reviewCandidates }: { builtInCount: number; reviewCandidates: KnowledgeReviewCandidate[] }) {
  const [entries, setEntries] = useState<AdminKnowledgeEntry[]>([]);
  const [draft, setDraft] = useState<EntryDraft>(EMPTY_ENTRY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/knowledge", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { entries?: AdminKnowledgeEntry[]; error?: string };
        if (!response.ok || !data.entries) throw new Error(data.error || "Knowledge entries could not be loaded");
        if (!cancelled) setEntries(data.entries);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Knowledge entries could not be loaded");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => `${entry.title} ${entry.category} ${entry.summary} ${entry.tags.join(" ")}`.toLowerCase().includes(query));
  }, [entries, search]);

  const availableReviewCandidates = useMemo(() => {
    const usedIds = new Set(entries.map((entry) => entry.sourceCandidateId).filter(Boolean));
    return reviewCandidates.filter((candidate) => !usedIds.has(candidate.id));
  }, [entries, reviewCandidates]);

  const categories = new Set(entries.map((entry) => entry.category)).size;
  const enabledCount = entries.filter((entry) => entry.enabled).length;

  function newEntry() {
    setEditingId(null);
    setDraft({ ...EMPTY_ENTRY });
    setError("");
    setNotice("");
    document.getElementById("knowledge-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  function editEntry(entry: AdminKnowledgeEntry) {
    setEditingId(entry.id);
    setDraft(draftFromEntry(entry));
    setError("");
    setNotice("");
    document.getElementById("knowledge-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  function loadReviewCandidate() {
    const candidate = availableReviewCandidates.find((item) => item.id === selectedCandidateId);
    if (!candidate) return;
    setEditingId(null);
    setDraft({
      ...EMPTY_ENTRY,
      sourceCandidateId: candidate.id,
      question: candidate.question,
      answer: candidate.answer,
      category: candidate.category,
      safetyNotes: candidate.safetyNote,
      tags: candidate.tags.join(", "),
      enabled: false,
    });
    setError("");
    setNotice("Source Q&A loaded as a draft. Review medical claims, add safety notes, then publish only when approved.");
    document.getElementById("knowledge-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/knowledge", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, entry: payload(draft) } : payload(draft)),
      });
      const data = await response.json() as { entries?: AdminKnowledgeEntry[]; error?: string };
      if (!response.ok || !data.entries) throw new Error(data.error || "Knowledge entry could not be saved");
      setEntries(data.entries);
      setNotice(draft.enabled ? "Published knowledge saved. Buddy can retrieve it now." : "Draft knowledge saved. Buddy will not retrieve it until published.");
      setEditingId(null);
      setDraft({ ...EMPTY_ENTRY });
      setSelectedCandidateId("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Knowledge entry could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function setPublished(entry: AdminKnowledgeEntry, enabled: boolean) {
    setError("");
    try {
      const response = await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, entry: { ...payload(draftFromEntry(entry)), enabled } }),
      });
      const data = await response.json() as { entries?: AdminKnowledgeEntry[]; error?: string };
      if (!response.ok || !data.entries) throw new Error(data.error || "Publish status could not be changed");
      setEntries(data.entries);
      setNotice(enabled ? "Entry published." : "Entry moved to drafts.");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Publish status could not be changed");
    }
  }

  async function deleteEntry(entry: AdminKnowledgeEntry) {
    if (!window.confirm(`Permanently delete “${entry.title}”?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/knowledge?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      const data = await response.json() as { entries?: AdminKnowledgeEntry[]; error?: string };
      if (!response.ok || !data.entries) throw new Error(data.error || "Knowledge entry could not be deleted");
      setEntries(data.entries);
      if (editingId === entry.id) newEntry();
      setNotice("Knowledge entry deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Knowledge entry could not be deleted");
    }
  }

  return (
    <>
      <div className="admin-stats">
        <article><BookOpen /><strong>{builtInCount}</strong><span>Editable baseline entries</span></article>
        <article><CheckCircle2 /><strong>{enabledCount}</strong><span>Published admin entries</span></article>
        <article><FilePenLine /><strong>{entries.length - enabledCount}</strong><span>Saved drafts</span></article>
        <article><Tags /><strong>{categories}</strong><span>Managed categories</span></article>
      </div>

      <div className="knowledge-workspace">
        <section className="admin-panel knowledge-editor" id="knowledge-editor">
          <div className="panel-heading">
            <div><span className="eyebrow">Question and answer</span><h2>{editingId ? "Edit knowledge" : "Add knowledge"}</h2></div>
            {editingId && <button type="button" className="admin-icon-button" onClick={newEntry} aria-label="Cancel editing"><X size={17} /></button>}
          </div>
          {availableReviewCandidates.length > 0 && (
            <div className="candidate-import">
              <label>Load a JSON review candidate<select value={selectedCandidateId} onChange={(event) => setSelectedCandidateId(event.target.value)}><option value="">Choose one of {availableReviewCandidates.length} source Q&amp;As…</option>{availableReviewCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.question}</option>)}</select></label>
              <button type="button" onClick={loadReviewCandidate} disabled={!selectedCandidateId}>Load draft</button>
              <p>Imported candidates are never published automatically. Review accuracy and safety before enabling them for Buddy.</p>
            </div>
          )}
          <form className="knowledge-form" onSubmit={saveEntry}>
            <label>Customer question or topic<input required minLength={3} maxLength={300} value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} placeholder="e.g. How should I transition my dog onto a new food?" /></label>
            <label>Approved answer<textarea required minLength={10} maxLength={12000} rows={8} value={draft.answer} onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))} placeholder="Write the factual answer Buddy should use. Include important limits and context." /></label>
            <div className="knowledge-form-row">
              <label>Category<input required maxLength={100} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="feeding-guidance" /></label>
              <label>Search keywords<input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="transition, change food, new diet" /></label>
            </div>
            <label>Short summary <small>Optional—generated from the answer if blank</small><textarea maxLength={500} rows={2} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} /></label>
            <label>Useful follow-up questions <small>One question per line</small><textarea rows={3} value={draft.followUpQuestions} onChange={(event) => setDraft((current) => ({ ...current, followUpQuestions: event.target.value }))} placeholder={'What food are they eating now?\nHow old is your pet?'} /></label>
            <label>Safety notes <small>One instruction per line</small><textarea rows={3} value={draft.safetyNotes} onChange={(event) => setDraft((current) => ({ ...current, safetyNotes: event.target.value }))} placeholder="Persistent or severe symptoms require veterinary advice." /></label>
            <label>Product matching tags <small>Optional, comma-separated Shopify/product tags</small><input value={draft.relevantProductTags} onChange={(event) => setDraft((current) => ({ ...current, relevantProductTags: event.target.value }))} placeholder="puppy, growth, sensitive-stomach" /></label>
            <label>Recommended product links <small>Optional, one All Good Petfood product URL per line</small><textarea rows={3} value={draft.recommendedProductUrls} onChange={(event) => setDraft((current) => ({ ...current, recommendedProductUrls: event.target.value }))} placeholder={'https://allgoodpetfood.co.nz/products/example-balm\nhttps://allgoodpetfood.co.nz/products/example-cream'} /></label>
            <label className="publish-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} /><span><strong>Publish for Buddy</strong><small>Turn this off to save as a staff-only draft.</small></span></label>
            {error && <p className="admin-error" role="alert">{error}</p>}
            {notice && <p className="admin-notice" role="status">{notice}</p>}
            <div className="knowledge-form-actions"><button type="button" onClick={newEntry}>Clear</button><button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Add knowledge"}</button></div>
          </form>
        </section>

        <section className="admin-panel knowledge-library">
          <div className="panel-heading"><div><span className="eyebrow">Supabase knowledge</span><h2>Managed entries</h2></div><button type="button" className="admin-add-button" onClick={newEntry}><Plus size={15} /> New</button></div>
          <label className="knowledge-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, categories or keywords" /></label>
          {loading ? <p className="admin-empty">Loading managed knowledge…</p> : filteredEntries.length === 0 ? <p className="admin-empty">{entries.length ? "No entries match that search." : "No managed entries yet. Add your first approved Q&A."}</p> : (
            <div className="managed-entry-list">
              {filteredEntries.map((entry) => (
                <article key={entry.id} className={!entry.enabled ? "draft" : ""}>
                  <div className="managed-entry-meta"><span>{entry.category.replaceAll("-", " ")}</span><i>{entry.enabled ? "Published" : "Draft"}</i></div>
                  <h3>{entry.title}</h3>
                  <p>{entry.summary}</p>
                  <div className="managed-entry-actions">
                    <button type="button" onClick={() => editEntry(entry)}>Edit</button>
                    <button type="button" onClick={() => void setPublished(entry, !entry.enabled)}>{entry.enabled ? "Unpublish" : "Publish"}</button>
                    <button type="button" className="danger" onClick={() => void deleteEntry(entry)}><Trash2 size={13} /> Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
