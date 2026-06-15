import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PlatformShell, Section } from "@/components/rakshak-platform/Shell";
import { completeCalendarOAuth } from "@/lib/rakshak-platform/google-calendar.functions";

export const Route = createFileRoute("/rakshak-platform/auth/calendar-callback")({
  component: CalendarCallbackPage,
});

function CalendarCallbackPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeCalendarOAuth);
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("Finishing Google Calendar connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    if (error) {
      setStatus("error");
      setMessage(`Google returned: ${error}`);
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Missing authorization code from Google.");
      return;
    }
    (async () => {
      try {
        const res = await complete({ data: { code, state, origin: window.location.origin } });
        setStatus("ok");
        setMessage(
          res.email
            ? `Connected ${res.email}. Redirecting to your profile…`
            : "Google Calendar connected. Redirecting to your profile…",
        );
        setTimeout(() => navigate({ to: "/rakshak-platform/profile" }), 1200);
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message ?? "Failed to complete connection.");
      }
    })();
  }, [complete, navigate]);

  return (
    <PlatformShell>
      <Section>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          {status === "working" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />}
          {status === "ok" && <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />}
          {status === "error" && <XCircle className="mx-auto h-8 w-8 text-red-500" />}
          <p className="mt-4 text-sm text-muted-foreground">{message}</p>
          {status === "error" && (
            <button
              onClick={() => navigate({ to: "/rakshak-platform/profile" })}
              className="mt-6 h-10 px-5 rounded-full border border-border hover:bg-muted text-sm"
            >
              Back to profile
            </button>
          )}
        </div>
      </Section>
    </PlatformShell>
  );
}
