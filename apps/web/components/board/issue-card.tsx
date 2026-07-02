"use client";

import { TypeBadge, PriorityBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/types";

/**
 * Presentational issue card. Drag behaviour lives in <BoardCard>, which wraps
 * this with Pragmatic Drag and Drop. `dragging` renders the faded "ghost" left
 * behind while the real card is being dragged.
 */
export function IssueCard({
  issue,
  onClick,
  dragging,
  className,
}: {
  issue: Issue;
  onClick?: () => void;
  dragging?: boolean;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "select-none rounded-lg border bg-card p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-150",
        "cursor-grab active:cursor-grabbing",
        dragging
          ? "opacity-40 grayscale"
          : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <p className="mb-2.5 text-sm font-medium leading-snug text-card-foreground">
        {issue.title}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={issue.type} />
          <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
        </div>
        <div className="flex items-center gap-2">
          {issue.storyPoints != null && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-secondary-foreground">
              {issue.storyPoints}
            </span>
          )}
          <PriorityBadge priority={issue.priority} showLabel={false} />
        </div>
      </div>
    </div>
  );
}
