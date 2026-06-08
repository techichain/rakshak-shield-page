import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformShell, Section, Eyebrow } from "@/components/rakshak-platform/Shell";

export const Route = createFileRoute("/rakshak-platform/notifications")({
  component: NotificationCenter,
  errorComponent: ({ error }) => <PlatformShell><Section><p>{String(error)}</p></Section></PlatformShell>,
  notFoundComponent: () => <PlatformShell><Section><p>Not found.</p></Section></PlatformShell>,
});

function NotificationCenter() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        location.href = "/rakshak-platform/auth";
        return;
      }
      const { data } = await supabase
        .from("rp_notifications")
        .select("*")
        .eq("recipient_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (active) {
        setItems(data ?? []);
        setLoading(false);
        const unread = (data ?? []).filter((n: any) => !n.is_read).map((n: any) => n.id);
        if (unread.length) {
          supabase.from("rp_notifications").update({ is_read: true }).in("id", unread);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <PlatformShell>
      <Section>
        <Eyebrow>Notifications</Eyebrow>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Everything that's happened.<br /><span className="text-brand">All in one place.</span>
        </h1>

        {loading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">You don't have any notifications yet.</p>
        ) : (
          <ul className="mt-10 divide-y divide-border rounded-2xl border border-border bg-background">
            {items.map((n) => (
              <li key={n.id} className="p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                {n.action_link && (
                  <a href={n.action_link} className="mt-2 inline-block text-xs text-brand hover:underline">
                    Open →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PlatformShell>
  );
}
