import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const [state, setState] = useState<
    "loading" | "valid" | "already" | "invalid" | "success" | "error"
  >("loading");
  const [busy, setBusy] = useState(false);
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState("valid");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (d.success) setState("success");
      else if (d.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center border border-border rounded-2xl p-8 bg-card">
        <h1 className="text-2xl font-bold mb-3">Email preferences</h1>
        {state === "loading" && <p className="text-muted-foreground">Checking link…</p>}
        {state === "invalid" && (
          <p className="text-muted-foreground">This unsubscribe link is invalid or expired.</p>
        )}
        {state === "already" && (
          <p className="text-muted-foreground">
            You're already unsubscribed. We won't email you again.
          </p>
        )}
        {state === "valid" && (
          <>
            <p className="text-muted-foreground mb-6">
              Click below to confirm you want to stop receiving emails from Project Rakshak.
            </p>
            <button
              onClick={confirm}
              disabled={busy}
              className="h-11 px-6 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {busy ? "Working…" : "Confirm unsubscribe"}
            </button>
          </>
        )}
        {state === "success" && (
          <p className="text-green-600">You've been unsubscribed successfully.</p>
        )}
        {state === "error" && (
          <p className="text-red-600">Something went wrong. Please try again later.</p>
        )}
      </div>
    </div>
  );
}
