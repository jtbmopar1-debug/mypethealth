"use client";

import { useEffect, useState } from "react";

const WARNING_WINDOW_MS = 5 * 60 * 1000;

function remainingLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function AdminSessionTimer({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() => expiresAt - Date.now());

  useEffect(() => {
    const update = () => {
      const nextRemaining = expiresAt - Date.now();
      setRemaining(nextRemaining);
      if (nextRemaining <= 0) window.location.replace("/");
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  if (remaining <= 0 || remaining > WARNING_WINDOW_MS) return null;

  return (
    <div className="admin-session-backdrop" role="presentation">
      <section className="admin-session-dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title" aria-describedby="session-warning-description">
        <span className="eyebrow">Session expiring</span>
        <h2 id="session-warning-title">Are you still working?</h2>
        <p id="session-warning-description">For security, you’ll be signed out in <strong>{remainingLabel(remaining)}</strong>. Continue working to renew your admin session.</p>
        <div className="admin-session-actions">
          <a href="/api/auth/shopify/logout">Sign out</a>
          <button type="button" autoFocus onClick={() => window.location.assign("/api/auth/shopify/start?silent=1&returnTo=%2Fadmin")}>Still working</button>
        </div>
      </section>
    </div>
  );
}
