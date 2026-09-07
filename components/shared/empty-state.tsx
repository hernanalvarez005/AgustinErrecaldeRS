import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Full-list empty state (spec point 60): title + description + one CTA,
 * no illustration. Consolidates the identical markup each list page
 * (`/properties`, `/contacts`, `/leads`, `/searches`, `/acquisitions`,
 * `/deals`) already duplicated — same visual, one place to change it.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      <Button render={<Link href={actionHref} />} nativeButton={false}>
        <Plus />
        {actionLabel}
      </Button>
    </div>
  );
}
