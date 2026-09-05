import { Construction } from "lucide-react";

/**
 * Placeholder for a nav destination that isn't built yet. Keeps every
 * sidebar link live (no dead 404s) while a section is still queued in
 * docs/ROADMAP.md, per the "no empty screen without context" rule.
 */
export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Construction className="text-muted-foreground size-8" />
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      </div>
      <p className="text-muted-foreground text-xs">
        Llega en {phase} — ver docs/ROADMAP.md
      </p>
    </div>
  );
}
