"use client";

import { useState } from "react";
import { LogOut, UserRound, X } from "lucide-react";

export interface ShopifyCustomer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function ShopifyAccountControl({ customer }: { customer: ShopifyCustomer }) {
  const [open, setOpen] = useState(false);

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
            <a className="auth-primary auth-signout" href="/api/auth/shopify/logout"><LogOut size={16} /> Sign out</a>
          </section>
        </div>
      )}
    </>
  );
}
