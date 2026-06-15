import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type Action =
  | { label: string; to: string; onClick?: never }
  | { label: string; onClick: () => void; to?: never };

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  tone = "muted",
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: Action;
  secondaryAction?: Action;
  tone?: "muted" | "card";
  className?: string;
}) {
  const surface =
    tone === "card"
      ? "border-border bg-card"
      : "border-dashed border-border bg-muted/30";
  return (
    <div
      className={`rounded-2xl border ${surface} p-8 sm:p-12 text-center ${className}`}
    >
      <div className="mx-auto h-12 w-12 rounded-full bg-brand-lite text-brand grid place-items-center">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-heading text-lg sm:text-xl font-semibold text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action && <ActionButton action={action} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="ghost" />}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  action,
  variant,
}: {
  action: Action;
  variant: "primary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "inline-flex items-center justify-center h-10 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
      : "inline-flex items-center justify-center h-10 rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground hover:bg-brand-lite";
  if ("to" in action && action.to) {
    return (
      <Link to={action.to} className={cls}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}
