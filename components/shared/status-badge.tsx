import { cn } from "cn";

import type { StatusTone } from "@/lib/status-tone";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-neutral/10 text-neutral dark:bg-neutral/20",
  primary: "bg-primary/10 text-primary dark:bg-primary/20",
  warning: "bg-warning/10 text-warning dark:bg-warning/20",
  success: "bg-success/10 text-success dark:bg-success/20",
  danger: "bg-danger/10 text-danger dark:bg-danger/20",
};

/**
 * Status/priority badge with a semantic color (V2.1 design system — see
 * docs/DESIGN_SYSTEM.md). Wraps the same visual language `Badge` already
 * uses for its `destructive` variant (`bg-x/10 text-x`) instead of
 * replacing it — every domain's status enum maps to a `tone` via
 * lib/status-tone.ts, this component only renders it.
 */
export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
