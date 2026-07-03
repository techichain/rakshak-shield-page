import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";
import { EmptyState } from "@/components/rakshak-platform/EmptyState";
import { useRPAuth, rpRequireRole } from "@/lib/rakshak-platform/auth";
import {
  listMyMailThreads,
  getMailThread,
  createMailThread,
  replyToMailThread,
  listMailRecipients,
} from "@/lib/rakshak-platform/mails.functions";
import { Loader2, Mail, Plus, Send, MessageCircle, X, Search } from "lucide-react";

export const Route = createFileRoute("/rakshak-platform/mails")({
  ssr: false,
  beforeLoad: async () => {
    await rpRequireRole([
      "cfi_admin", "super_admin", "team_leader", "team_member", "mentor", "evaluator",
    ]);
  },
  validateSearch: (s: Record<string, unknown>) => ({
    thread: typeof s.thread === "string" ? s.thread : undefined,
  }),
  component: MailsPage,
});

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function MailsPage() {
  const search = useSearch({ from: "/rakshak-platform/mails" });
  const { userId } = useRPAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyMailThreads);
  const getFn = useServerFn(getMailThread);

  const [selectedId, setSelectedId] = useState<string | null>(search.thread ?? null);
  const [composerOpen, setComposerOpen] = useState(false);

  const threadsQ = useQuery({
    queryKey: ["mail-threads"],
    queryFn: () => listFn(),
    refetchOnWindowFocus: false,
  });

  const threadQ = useQuery({
    queryKey: ["mail-thread", selectedId],
    queryFn: () => getFn({ data: { threadId: selectedId! } }),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (search.thread && search.thread !== selectedId) setSelectedId(search.thread);
  }, [search.thread]); // eslint-disable-line react-hooks/exhaustive-deps

  const threads = threadsQ.data?.threads ?? [];

  return (
    <PlatformShell>
      <Section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Inbox</Eyebrow>
            <h1 className="mt-6 font-heading text-4xl sm:text-5xl font-bold leading-[1.05]">
              Mails
              <br />
              <span className="text-brand">Message admins, mentors & teammates</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl">
              Direct in-app conversations. Every new message is also emailed to the recipient so nothing slips.
            </p>
          </div>
          <button
            onClick={() => setComposerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2.5 text-sm font-semibold hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" /> New message
          </button>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* Thread list */}
          <aside className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2 text-sm font-semibold">
              <Mail className="h-4 w-4 text-brand" /> Conversations
              {threadsQ.isLoading && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
            </div>
            {threads.length === 0 && !threadsQ.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">
                No conversations yet. Start one with the "New message" button.
              </div>
            ) : (
              <ul className="max-h-[600px] overflow-y-auto">
                {threads.map((t: any) => {
                  const others = (t.participants ?? []).filter((p: any) => p.profile_id !== userId);
                  const active = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition ${
                          active ? "bg-brand-lite" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-sm truncate">
                            {others.map((p: any) => p.full_name || p.email).join(", ") || "You"}
                          </div>
                          {t.unread_count > 0 && (
                            <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-brand text-brand-foreground text-[10px] font-bold px-1.5">
                              {t.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-foreground/80 truncate">{t.subject}</div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {t.last_message_preview || "—"}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{timeAgo(t.last_message_at)}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Thread detail */}
          <section className="rounded-2xl border border-border bg-card min-h-[500px] flex flex-col">
            {!selectedId ? (
              <div className="p-8 flex-1 flex items-center justify-center">
                <EmptyState
                  icon={MessageCircle}
                  title="Select a conversation"
                  description="Pick a conversation from the list or start a new one."
                />
              </div>
            ) : threadQ.isLoading ? (
              <div className="p-8 flex-1 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
              </div>
            ) : threadQ.data ? (
              <ThreadView
                data={threadQ.data}
                userId={userId ?? ""}
                onReplied={() => {
                  qc.invalidateQueries({ queryKey: ["mail-thread", selectedId] });
                  qc.invalidateQueries({ queryKey: ["mail-threads"] });
                }}
              />
            ) : null}
          </section>
        </div>
      </Section>

      {composerOpen && (
        <Composer
          onClose={() => setComposerOpen(false)}
          onCreated={(threadId) => {
            setComposerOpen(false);
            setSelectedId(threadId);
            qc.invalidateQueries({ queryKey: ["mail-threads"] });
          }}
        />
      )}
    </PlatformShell>
  );
}

function ThreadView({
  data, userId, onReplied,
}: {
  data: any; userId: string; onReplied: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const replyFn = useServerFn(replyToMailThread);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await replyFn({ data: { threadId: data.thread.id, body: body.trim() } });
      setBody("");
      onReplied();
    } catch (e: any) {
      toast.error(e?.message || "Could not send");
    } finally {
      setSending(false);
    }
  };

  const others = (data.participants ?? []).filter((p: any) => p.profile_id !== userId);

  return (
    <>
      <div className="p-5 border-b border-border">
        <div className="text-xs text-muted-foreground">Conversation with</div>
        <div className="font-semibold text-base">
          {others.map((p: any) => p.rp_profiles?.full_name || p.rp_profiles?.email).join(", ") || "—"}
        </div>
        <div className="mt-1 text-lg font-heading font-bold">{data.thread.subject}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[520px]">
        {(data.messages ?? []).map((m: any) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                mine ? "bg-brand text-brand-foreground" : "bg-muted text-foreground"
              }`}>
                <div className="text-[11px] opacity-80 mb-1">
                  {m.rp_profiles?.full_name || m.rp_profiles?.email || "Unknown"} · {timeAgo(m.sent_at)}
                </div>
                <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={2}
            placeholder="Write a reply… (Cmd/Ctrl+Enter to send)"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand text-brand-foreground px-4 text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </div>
    </>
  );
}

function Composer({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (threadId: string) => void }) {
  const recipientsFn = useServerFn(listMailRecipients);
  const createFn = useServerFn(createMailThread);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const q = useQuery({ queryKey: ["mail-recipients"], queryFn: () => recipientsFn() });
  const allRecipients = useMemo(
    () => (q.data?.groups ?? []).flatMap((g: any) => g.recipients.map((r: any) => ({ ...r, group: g.label }))),
    [q.data],
  );
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allRecipients;
    return allRecipients.filter((r: any) =>
      (r.name || "").toLowerCase().includes(s) || (r.email || "").toLowerCase().includes(s),
    );
  }, [allRecipients, search]);

  const submit = async () => {
    if (!subject.trim() || !body.trim() || picked.length === 0) return;
    setSending(true);
    try {
      const res = await createFn({
        data: {
          subject: subject.trim(),
          body: body.trim(),
          recipientIds: picked,
        },
      });
      toast.success("Message sent");
      onCreated(res.threadId);
    } catch (e: any) {
      toast.error(e?.message || "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-background border border-border shadow-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold">New message</h2>
            <p className="text-xs text-muted-foreground">Recipients also receive an email notification.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Recipients ({picked.length})</label>
            <div className="mt-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search admins, mentors, teammates…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            {picked.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {picked.map((id) => {
                  const r = allRecipients.find((x: any) => x.id === id);
                  if (!r) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 bg-brand-lite text-brand text-xs px-2 py-1 rounded-full">
                      {r.name}
                      <button onClick={() => setPicked(picked.filter((p) => p !== id))} className="hover:bg-brand/10 rounded">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
              {q.isLoading ? (
                <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/> Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">No recipients available.</div>
              ) : (
                filtered.map((r: any) => {
                  const isPicked = picked.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setPicked(isPicked ? picked.filter((p) => p !== r.id) : [...picked, r.id])}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between border-b border-border/50 last:border-0 ${
                        isPicked ? "bg-brand-lite" : ""
                      }`}
                    >
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.email} · {r.group}</div>
                      </div>
                      {isPicked && <span className="text-xs text-brand font-semibold">✓ Added</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
              maxLength={200}
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={8000}
              placeholder="Write your message…"
              className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
          <button
            onClick={submit}
            disabled={sending || !subject.trim() || !body.trim() || picked.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-brand text-brand-foreground font-semibold hover:bg-brand/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
            Send message
          </button>
        </div>
      </div>
    </div>
  );
}
