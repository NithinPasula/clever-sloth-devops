"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TypeBadge, PriorityBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/types";

export function IssueCard({
  issue,
  onClick,
}: {
  issue: Issue;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "grab-cursor touch-none rounded-md border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
        isDragging && "opacity-40",
      )}
    >
      <p className="mb-2 text-sm font-medium leading-snug">{issue.title}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeBadge type={issue.type} />
          <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
        </div>
        <PriorityBadge priority={issue.priority} />
      </div>
    </div>
  );
}
