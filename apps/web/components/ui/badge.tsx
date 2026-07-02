import { cn } from "@/lib/utils";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/types";

/** Generic pill used for counts, labels, statuses. */
export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        "bg-secondary text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Issue-type badge: a small colored chip used on cards and detail views. */
export function TypeBadge({ type }: { type: IssueType }) {
  const map: Record<IssueType, { label: string; className: string }> = {
    epic: { label: "Epic", className: "bg-epic/15 text-epic" },
    story: { label: "Story", className: "bg-story/15 text-story" },
    task: { label: "Task", className: "bg-task/20 text-task" },
    subtask: { label: "Sub-task", className: "bg-subtask/15 text-subtask" },
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
export function PriorityBadge({
  priority,
  showLabel = true,
}: {
  priority: IssuePriority;
  showLabel?: boolean;
}) {
  const map: Record<IssuePriority, { label: string; dot: string }> = {
    critical: { label: "Critical", dot: "bg-priority-critical" },
    high: { label: "High", dot: "bg-priority-high" },
    medium: { label: "Medium", dot: "bg-priority-medium" },
    low: { label: "Low", dot: "bg-priority-low" },
  };
  const { label, dot } = map[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {showLabel && label}
    </span>
  );
}

/** Column/status chip. */
export function StatusBadge({ status }: { status: IssueStatus }) {
  const map: Record<IssueStatus, { label: string; className: string }> = {
    todo: { label: "To Do", className: "bg-muted text-muted-foreground" },
    in_progress: { label: "In Progress", className: "bg-task/20 text-task" },
    in_review: { label: "In Review", className: "bg-priority-high/20 text-priority-high" },
    done: { label: "Done", className: "bg-story/20 text-story" },
  };
  const { label, className } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}
