import { forwardRef } from "react";
import type { ComponentType, SVGProps } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared Icon wrapper.
 *
 * Enforces a single, consistent lucide-react icon style across the app:
 *  - stroke width: 2 (default), tunable via `strokeWidth`
 *  - size presets:  xs(12) · sm(14) · md(16, default) · lg(20) · xl(24)
 *  - vertical alignment: middle (prevents the classic "icon sits 1px low" bug
 *    when placed inline next to text)
 *  - inherits `currentColor` so it always matches surrounding text
 *
 * Usage:
 *   import { Icon } from "@/components/ui/icon";
 *   import { Check } from "lucide-react";
 *
 *   <Icon as={Check} />                    // 16px, stroke 2
 *   <Icon as={Check} size="sm" />          // 14px
 *   <Icon as={Check} size={18} />          // raw pixel size
 *   <Icon as={Check} className="text-brand" />
 *   <Icon as={Check} label="Approved" />   // accessible name (otherwise hidden)
 */

type LucideIconComponent = ComponentType<LucideProps>;

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

const SIZE_MAP: Record<Exclude<IconSize, number>, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export interface IconProps
  extends Omit<SVGProps<SVGSVGElement>, "ref" | "color"> {
  /** lucide-react icon component, e.g. `Check`, `X`, `Bell`. */
  as: LucideIconComponent;
  /** Preset (`xs`–`xl`) or raw pixel size. Defaults to `md` (16). */
  size?: IconSize;
  /** Stroke width. Defaults to 2 for a consistent look. */
  strokeWidth?: number;
  /**
   * Accessible name. When provided, the icon becomes a labelled image.
   * Otherwise it is hidden from assistive tech (`aria-hidden`) and is
   * treated as decorative — pair it with adjacent text.
   */
  label?: string;
}

function resolveSize(size: IconSize | undefined): number {
  if (typeof size === "number") return size;
  return SIZE_MAP[size ?? "md"];
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { as: Component, size = "md", strokeWidth = 2, label, className, ...rest },
  ref,
) {
  const px = resolveSize(size);
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true, focusable: false as const };

  return (
    <Component
      ref={ref}
      width={px}
      height={px}
      strokeWidth={strokeWidth}
      className={cn("inline-block shrink-0 align-middle", className)}
      {...a11y}
      {...rest}
    />
  );
});

export default Icon;
