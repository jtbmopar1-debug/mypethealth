"use client";

import { FormEvent, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut, UserRound, X } from "lucide-react";
import { getBrowserSupabaseClient } from "@/services/supabase/client";

interface AccountControlProps {
  user: User | null;
  shopifyCustomer: ShopifyCustomer | null;
  configured: boolean;
}

export interface ShopifyCustomer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function AccountControl({ user, shopifyCustomer, configured }: AccountControlProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setMessage("Supabase needs a project URL and publishable key before accounts can be used.");
      return;
    }

    setBusy(true);
    setMessage("");
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name.trim() },
          },
        });
    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }
    setOpen(false);
    setPassword("");
  }

  async function signOut() {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) setMessage(error.message);
    else setOpen(false);
  }

  return (
    <>
      <button className="account-button" onClick={() => { setMessage(""); setOpen(true); }}>
        {user || shopifyCustomer ? <UserRound size={16} /> : <LogIn size={16} />}
        <span>{user || shopifyCustomer ? "My account" : "Sign in"}</span>
      </button>
      {open && (
        <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="auth-close" aria-label="Close account window" onClick={() => setOpen(false)}><X size={19} /></button>
            {user || shopifyCustomer ? (
              <>
                <span className="eyebrow">My Pet Health account</span>
                <h2 id="auth-title">You’re signed in</h2>
                <p className="auth-email">{user?.email ?? shopifyCustomer?.email ?? "All Good Petfood customer"}</p>
                <p>{user
                  ? "Your Buddy conversations are saved securely to your account and available on your other devices."
                  : "Your All Good Petfood identity is connected. We’ll link its saved Buddy chats to Supabase in the next setup step."}</p>
                {user
                  ? <button className="auth-primary auth-signout" disabled={busy} onClick={() => void signOut()}><LogOut size={16} /> Sign out</button>
                  : <a className="auth-primary auth-signout" href="/api/auth/shopify/logout"><LogOut size={16} /> Sign out</a>}
                {message && <p className="auth-message error" role="alert">{message}</p>}
              </>
            ) : (
              <>
                <span className="eyebrow">Save your Buddy chats</span>
                <h2 id="auth-title">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h2>
                <p>Sign in to keep your conversations available across devices.</p>
                {!configured && <p className="auth-message error">Supabase configuration is incomplete.</p>}
                <div className="auth-tabs" role="tablist" aria-label="Account action">
                  <button className={mode === "sign-in" ? "active" : ""} role="tab" aria-selected={mode === "sign-in"} onClick={() => { setMode("sign-in"); setMessage(""); }}>Sign in</button>
                  <button className={mode === "sign-up" ? "active" : ""} role="tab" aria-selected={mode === "sign-up"} onClick={() => { setMode("sign-up"); setMessage(""); }}>Sign up</button>
                </div>
                <form className="auth-form" onSubmit={submit}>
                  {mode === "sign-up" && <label>First name<input type="text" autoComplete="given-name" maxLength={40} required value={name} onChange={(event) => setName(event.target.value)} /></label>}
                  <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                  <label>Password<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                  <button className="auth-primary" type="submit" disabled={busy || !configured}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
                </form>
                {message && <p className={`auth-message${message.startsWith("Check") ? " success" : " error"}`} role="status">{message}</p>}
                <div className="auth-divider"><span>or</span></div>
                <a className="shopify-auth-button" href="/api/auth/shopify/start">Continue with All Good Petfood</a>
                <small className="auth-shopify-note">Uses your existing All Good Petfood customer account. My Pet Health never receives your Shopify password.</small>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
