import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic loading fallback for `loading.tsx` route segments (spec point
 * 61 — skeletons that roughly match the content's structure, not a
 * spinner). Approximates the "page title + row of cards" shape shared by
 * every list/index page in the dashboard (`/today`, `/dashboard`,
 * `/properties`, `/contacts`, `/leads`, `/searches`, `/acquisitions`,
 * `/deals`) closely enough to avoid a layout jump when the real content
 * arrives, without needing a bespoke skeleton per route.
 */
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
