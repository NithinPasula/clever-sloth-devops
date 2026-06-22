"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { IssueCard } from "./issue-card";
import { cn } from "@/lib/utils";
import type { Issue, IssueStatus } from "@/lib/types";

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
  // The column itself is a drop target so cards can be dropped into empty space.
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {issues.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 p-2 transition-colors",
          isOver && "bg-primary/5",
        )}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onClick={() => onCardClick(issue)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
