import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Notif = {
  id: string;
  title: string;
  message: string | null;
  action_link: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("rp_notifications")
        .select("id, title, message, action_link, type, is_read, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (active) setItems((data as Notif[]) ?? []);
    })();
    const channel = supabase
      .channel(`rp_notif_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rp_notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((cur) => [n, ...cur].slice(0, 30));
          toast(n.title, {
            description: n.message ?? undefined,
            action: n.action_link
              ? { label: "Open", onClick: () => { window.location.href = n.action_link!; } }
              : undefined,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rp_notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => setItems((cur) => cur.map((n) => (n.id === (payload.new as Notif).id ? (payload.new as Notif) : n))),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  async function markAllRead() {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((cur) => cur.map((n) => ({ ...n, is_read: true })));
    await supabase.from("rp_notifications").update({ is_read: true }).in("id", ids);
  }

  async function markRead(id: string) {
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("rp_notifications").update({ is_read: true }).eq("id", id);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 rounded-full border border-border flex items-center justify-center hover:border-brand/40"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-brand text-brand-foreground text-[10px] font-semibold flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-[26rem] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-heading text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          )}
          <ul>
            {items.map((n) => (
              <li key={n.id} className={`border-b border-border last:border-b-0 ${n.is_read ? "" : "bg-brand-lite/40"}`}>
                <button
                  onClick={() => markRead(n.id)}
                  className="block w-full text-left px-4 py-3 hover:bg-brand-lite/60"
                >
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.message && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Link
            to="/rakshak-platform/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-xs text-brand hover:underline border-t border-border"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
