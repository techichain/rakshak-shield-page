import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, X, Users, UserPlus, FolderPlus } from "lucide-react";
import { AdminCreateTeamDialog } from "./AdminCreateTeamDialog";

/**
 * Floating speed-dial action button for admin screens.
 * Bottom-right; expands into quick-create options.
 */
export function AdminFAB() {
  const [open, setOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const items: Array<{ label: string; icon: typeof Users; onClick: () => void }> = [
    {
      label: "Create team",
      icon: Users,
      onClick: () => { setOpen(false); setTeamOpen(true); },
    },
    {
      label: "Invite role",
      icon: UserPlus,
      onClick: () => { setOpen(false); navigate({ to: "/rakshak-platform/admin/access-requests" }); },
    },
    {
      label: "New cohort",
      icon: FolderPlus,
      onClick: () => { setOpen(false); navigate({ to: "/rakshak-platform/admin/cohorts" }); },
    },
  ];

  return (
    <>
      {/* dim backdrop when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.label}
                  onClick={it.onClick}
                  className="group flex items-center gap-2 rounded-full bg-card border border-border shadow-lg pl-3 pr-4 py-2 text-sm font-medium text-foreground hover:border-brand hover:text-brand transition"
                >
                  <span className="h-7 w-7 rounded-full bg-brand/10 text-brand grid place-items-center group-hover:bg-brand group-hover:text-brand-foreground transition">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {it.label}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setOpen((s) => !s)}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          className="h-14 w-14 rounded-full bg-brand text-brand-foreground shadow-xl shadow-brand/30 grid place-items-center hover:scale-105 active:scale-95 transition"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      <AdminCreateTeamDialog
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
      />
    </>
  );
}
