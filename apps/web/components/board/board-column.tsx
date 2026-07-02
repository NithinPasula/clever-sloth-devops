"use client";

import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { BoardCard } from "./board-card";
import { cn } from "@/lib/utils";
import type { Issue, IssueStatus } from "@/lib/types";

/** Small colored dot per column so the board reads at a glance. */
const STATUS_DOT: Record<IssueStatus, string> = {
  todo: "bg-muted-foreground/50",
  in_progress: "bg-task",
  in_review: "bg-priority-high",
  done: "bg-story",
};

export function BoardColumn({
  status,
  label,
  issues,
  onCardClick,
}: {
  status: IssueStatus;
  label: string;
  issues: Issue[];
  onCardClick: (issue: Issue) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);

  // The card area is a drop target so cards can be dropped into empty space or
  // at the end of the list (when not hovering a specific card).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ type: "column", status }),
      canDrop: ({ source }) => source.data.type === "card",
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [status]);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </h3>
        </div>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-xs font-medium text-muted-foreground">
          {issues.length}
        </span>
      </div>
      <div
        ref={ref}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl p-2 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/30",
        )}
      >
        {issues.map((issue) => (
          <BoardCard key={issue.id} issue={issue} onClick={() => onCardClick(issue)} />
        ))}
        {issues.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-6 text-xs text-muted-foreground/70">
            Drop issues here
          </div>
        )}
      </div>
    </div>
  );
}
