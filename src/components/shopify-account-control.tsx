"use client";

import { useState } from "react";
import { Download, LogOut, Trash2, UserRound, X } from "lucide-react";
import { conversationStore } from "@/services/conversations/local-storage-store";

export interface ShopifyCustomer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function ShopifyAccountControl({ customer }: { customer: ShopifyCustomer }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [message, setMessage] = useState("");

  async function downloadData() {
    setBusy("export");
    setMessage("");
    try {
      const response = await fetch("/api/customer-data", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Export failed");
      const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `buddy-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      setMessage("Your Buddy data export has downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Buddy data could not be exported.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteData() {
    if (!window.confirm("Delete all Buddy conversations and pet profiles? This cannot be undone. Your Shopify account and orders will not be deleted.")) return;
    setBusy("delete");
    setMessage("");
    try {
      const response = await fetch("/api/customer-data", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Deletion failed");
      await conversationStore.clear();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Buddy data could not be deleted.");
      setBusy(null);
    }
  }

  return (
    <>
      <button className="account-button" onClick={() => setOpen(true)}>
        <UserRound size={16} />
        <span>My account</span>
      </button>
      {open && (
        <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="auth-close" aria-label="Close account window" onClick={() => setOpen(false)}><X size={19} /></button>
            <span className="eyebrow">All Good Petfood account</span>
            <h2 id="auth-title">You&apos;re signed in</h2>
            <p className="auth-email">{customer.email ?? "All Good Petfood customer"}</p>
            <p>Your Buddy conversations are securely linked to your All Good Petfood customer account.</p>
            <div className="account-data-actions">
              <button className="auth-secondary" type="button" onClick={downloadData} disabled={busy !== null}>
                <Download size={16} /> {busy === "export" ? "Preparing…" : "Download Buddy data"}
              </button>
              <button className="auth-danger" type="button" onClick={deleteData} disabled={busy !== null}>
                <Trash2 size={16} /> {busy === "delete" ? "Deleting…" : "Delete Buddy data"}
              </button>
            </div>
            <p className="account-data-note">This covers Buddy chats and pet profiles only. Your Shopify account, orders and payment details are not changed.</p>
            {message && <p className="auth-message">{message}</p>}
            <a className="auth-primary auth-signout" href="/api/auth/shopify/logout"><LogOut size={16} /> Sign out</a>
          </section>
        </div>
      )}
    </>
  );
}
