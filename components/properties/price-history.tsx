import { daysSinceNow, formatEventDay } from "@/lib/format";

export type PriceHistoryEntry = {
  id: string;
  previous_price: number | null;
  new_price: number | null;
  currency: "ARS" | "USD" | null;
  changed_at: string;
};

function formatPercentChange(previous: number, next: number): string {
  const pct = ((next - previous) / previous) * 100;
  const arrow = pct < 0 ? "↓" : pct > 0 ? "↑" : "";
  const formatted = Math.abs(pct).toLocaleString("es-AR", {
    maximumFractionDigits: 1,
  });
  return `${arrow} ${formatted}%`.trim();
}

/**
 * `entries` is written entirely by the `properties_log_price_change`
 * trigger (V2 bloque C) — the app never writes this table directly. Sorted
 * oldest-first by the caller so this reads top-to-bottom as it happened.
 */
export function PriceHistory({ entries }: { entries: PriceHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Sin cambios de precio registrados.
      </p>
    );
  }

  const lastChange = entries[entries.length - 1];
  const daysSinceLastChange = daysSinceNow(lastChange.changed_at);

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2">
            <span className="text-muted-foreground w-16 shrink-0">
              {formatEventDay(entry.changed_at)}
            </span>
            <span className="font-medium">
              {entry.currency ?? ""}{" "}
              {entry.new_price?.toLocaleString("es-AR") ?? "—"}
            </span>
            {entry.previous_price !== null && entry.new_price !== null ? (
              <span className="text-muted-foreground">
                {formatPercentChange(entry.previous_price, entry.new_price)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        {daysSinceLastChange === 0
          ? "Último ajuste: hoy."
          : daysSinceLastChange === 1
            ? "Último ajuste: hace 1 día."
            : `Último ajuste: hace ${daysSinceLastChange} días.`}
      </p>
    </div>
  );
}
