import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listSubmissionMessages, postSubmissionMessage } from "@/lib/rakshak-platform/messages.functions";
import { Send } from "lucide-react";

type Msg = {
  id: string;
  submission_id: string;
  reviewer_id: string | null;
  reviewer_role: string | null;
  feedback_text: string | null;
  status: string | null;
  created_at: string;
};

const ROLE_META: Record<string, { label: string; cls: string }> = {
  admin:       { label: "Admin",   cls: "bg-brand text-brand-foreground" },
  mentor:      { label: "Mentor",  cls: "bg-amber-500 text-white" },
  evaluator:   { label: "Evaluator", cls: "bg-sky-600 text-white" },
  team_member: { label: "Team",    cls: "bg-emerald-600 text-white" },
};

export function MessageThread({
  submissionId,
  currentUserId,
  className = "",
}: {
  submissionId: string;
  currentUserId: string | null;
  className?: string;
}) {
  const fetchFn = useServerFn(listSubmissionMessages);
  const sendFn = useServerFn(postSubmissionMessage);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rp-thread", submissionId],
    queryFn: () => fetchFn({ data: { submissionId } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`rp_thread_${submissionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rp_feedback", filter: `submission_id=eq.${submissionId}` },
        () => qc.invalidateQueries({ queryKey: ["rp-thread", submissionId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [submissionId, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data?.messages?.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      await sendFn({ data: { submissionId, message: text.trim() } });
      setText("");
      qc.invalidateQueries({ queryKey: ["rp-thread", submissionId] });
    } catch (e: any) {
      setErr(e?.message ?? "Could not send");
    } finally {
      setBusy(false);
    }
  }

  const messages = (data?.messages ?? []) as Msg[];

  return (
    <div className={`rounded-2xl border border-border bg-background flex flex-col ${className}`}>
      <div className="px-5 py-3 border-b border-border">
        <div className="font-heading text-base font-semibold">Discussion</div>
        <p className="text-xs text-muted-foreground">Team ↔ mentor ↔ admin · live</p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[28rem] min-h-[16rem]">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
        )}
        {messages.map((m) => {
          const mine = m.reviewer_id && m.reviewer_id === currentUserId;
          const role = ROLE_META[m.reviewer_role ?? "team_member"] ?? ROLE_META.team_member;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${role.cls}`}>
                    {role.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <div
                  className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                    mine ? "bg-brand text-brand-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {m.feedback_text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={onSend} className="border-t border-border p-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={4000}
          className="rp-input flex-1"
          disabled={busy || !currentUserId}
        />
        <button
          type="submit"
          disabled={busy || !text.trim() || !currentUserId}
          className="h-10 px-4 rounded-full bg-brand text-brand-foreground text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> Send
        </button>
      </form>
      {err && <p className="px-4 pb-3 text-xs text-red-600">{err}</p>}
    </div>
  );
}
