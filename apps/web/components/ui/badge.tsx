import { cn } from "@/lib/utils";
import type { IssuePriority, IssueType } from "@/lib/types";

/** Issue-type badge: a small colored chip used on cards and detail views. */
export function TypeBadge({ type }: { type: IssueType }) {
  const map: Record<IssueType, { label: string; className: string }> = {
    epic: { label: "Epic", className: "bg-epic/15 text-epic" },
    story: { label: "Story", className: "bg-story/15 text-story" },
    task: { label: "Task", className: "bg-task/15 text-task" },
    subtask: { label: "Sub-task", className: "bg-task/15 text-task" },
    bug: { label: "Bug", className: "bg-bug/15 text-bug" },
  };
  const { label, className } = map[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Priority dot + label. */
export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const map: Record<IssuePriority, { label: string; dot: string }> = {
    critical: { label: "Critical", dot: "bg-bug" },
    high: { label: "High", dot: "bg-orange-500" },
    medium: { label: "Medium", dot: "bg-task" },
    low: { label: "Low", dot: "bg-muted-foreground" },
  };
  const { label, dot } = map[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}
