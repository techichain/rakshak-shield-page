import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  _optimistic?: boolean;
  _failed?: boolean;
};

const ROLE_META: Record<string, { label: string; cls: string }> = {
  admin:       { label: "Admin",     cls: "bg-brand text-brand-foreground" },
  mentor:      { label: "Mentor",    cls: "bg-amber-500 text-white" },
  evaluator:   { label: "Evaluator", cls: "bg-sky-600 text-white" },
  team_member: { label: "Team",      cls: "bg-emerald-600 text-white" },
};

const MAX_LEN = 4000;

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
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rp-thread", submissionId],
    queryFn: () => fetchFn({ data: { submissionId } }),
  });

  // Realtime: refetch on any new feedback row for this submission
  useEffect(() => {
    const ch = supabase
      .channel(`rp_thread_${submissionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rp_feedback", filter: `submission_id=eq.${submissionId}` },
        (payload) => {
          // Drop any optimistic copy that matches the just-inserted server row
          const inserted = payload.new as Msg;
          setOptimistic((cur) =>
            cur.filter(
              (o) =>
                !(o.reviewer_id === inserted.reviewer_id && o.feedback_text === inserted.feedback_text),
            ),
          );
          qc.invalidateQueries({ queryKey: ["rp-thread", submissionId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [submissionId, qc]);

  const serverMessages = (data?.messages ?? []) as Msg[];
  const messages: Msg[] = [...serverMessages, ...optimistic];

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Auto-grow textarea
  useEffect(() => {
    const t = textareaRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
  }, [text]);

  async function send() {
    const value = text.trim();
    if (!value || busy || !currentUserId) return;
    setBusy(true);
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Msg = {
      id: tempId,
      submission_id: submissionId,
      reviewer_id: currentUserId,
      reviewer_role: "team_member", // best-guess label; server fills the real one
      feedback_text: value,
      status: "comment",
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setOptimistic((cur) => [...cur, optimisticMsg]);
    setText("");
    try {
      await sendFn({ data: { submissionId, message: value } });
      // Realtime listener will drop the optimistic row when the real one arrives.
      // As a fallback in case realtime is delayed, also refetch shortly.
      qc.invalidateQueries({ queryKey: ["rp-thread", submissionId] });
    } catch (e: any) {
      setOptimistic((cur) =>
        cur.map((m) => (m.id === tempId ? { ...m, _failed: true } : m)),
      );
      toast.error("Couldn't send message", { description: e?.message ?? "Try again" });
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={`rounded-2xl border border-border bg-background flex flex-col ${className}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-heading text-base font-semibold">Discussion</div>
          <p className="text-xs text-muted-foreground">Team ↔ mentor ↔ admin · live</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[28rem] min-h-[16rem]"
      >
        {isLoading && (
          <div className="space-y-3">
            <div className="h-12 w-2/3 rounded-2xl bg-muted/40 animate-pulse" />
            <div className="h-12 w-1/2 ml-auto rounded-2xl bg-muted/40 animate-pulse" />
            <div className="h-12 w-3/5 rounded-2xl bg-muted/40 animate-pulse" />
          </div>
        )}
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
                  <span
                    className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${role.cls}`}
                  >
                    {role.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                  {m._optimistic && !m._failed && (
                    <span className="text-[10px] text-muted-foreground italic">sending…</span>
                  )}
                  {m._failed && (
                    <span className="text-[10px] text-red-600 font-medium">failed</span>
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                    mine ? "bg-brand text-brand-foreground" : "bg-muted text-foreground"
                  } ${m._optimistic ? "opacity-70" : ""} ${m._failed ? "ring-1 ring-red-400" : ""}`}
                >
                  {m.feedback_text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-border p-3"
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={onKeyDown}
            placeholder={currentUserId ? "Write a message… (Enter to send, Shift+Enter for newline)" : "Sign in to reply"}
            rows={1}
            className="rp-input flex-1 resize-none leading-snug py-2"
            disabled={busy || !currentUserId}
          />
          <button
            type="submit"
            disabled={busy || !text.trim() || !currentUserId}
            className="h-10 px-4 rounded-full bg-brand text-brand-foreground text-sm inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            <Send className="h-3.5 w-3.5" /> Send
          </button>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Press Enter to send · Shift+Enter for newline</span>
          <span>{text.length}/{MAX_LEN}</span>
        </div>
      </form>
    </div>
  );
}
