"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Layers, Loader2, CheckCircle2, TrendingUp } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Issue, IssuePriority, IssueStatus, IssueType } from "@/lib/types";

const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

const STATUS_BAR: Record<IssueStatus, string> = {
  todo: "bg-muted-foreground/50",
  in_progress: "bg-task",
  in_review: "bg-priority-high",
  done: "bg-story",
};
const TYPE_BAR: Record<IssueType, string> = {
  epic: "bg-epic",
  story: "bg-story",
  task: "bg-task",
  subtask: "bg-subtask",
  bug: "bg-bug",
};
const PRIORITY_BAR: Record<IssuePriority, string> = {
  critical: "bg-priority-critical",
  high: "bg-priority-high",
  medium: "bg-priority-medium",
  low: "bg-priority-low",
};

function tally<T extends string>(items: Issue[], key: (i: Issue) => T) {
  const out = {} as Record<T, number>;
  for (const i of items) {
    const k = key(i);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function Bar({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", className ?? "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right tabular-nums">{value}</span>
    </div>
  );
}

export default function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setIssues(await apiGet<Issue[]>(`/projects/${projectId}/issues`));
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const stats = useMemo(() => {
    const total = issues.length;
    const done = issues.filter((i) => i.status === "done").length;
    const inProgress = issues.filter((i) => i.status === "in_progress").length;
    return {
      total,
      done,
      inProgress,
      completion: total ? Math.round((done / total) * 100) : 0,
      byStatus: tally<IssueStatus>(issues, (i) => i.status),
      byType: tally<IssueType>(issues, (i) => i.type),
      byPriority: tally<IssuePriority>(issues, (i) => i.priority),
    };
  }, [issues]);

  const statuses: IssueStatus[] = ["todo", "in_progress", "in_review", "done"];
  const types: IssueType[] = ["epic", "story", "task", "subtask", "bug"];
  const priorities: IssuePriority[] = ["critical", "high", "medium", "low"];
  const maxStatus = Math.max(1, ...statuses.map((s) => stats.byStatus[s] ?? 0));
  const maxType = Math.max(1, ...types.map((t) => stats.byType[t] ?? 0));
  const maxPriority = Math.max(1, ...priorities.map((p) => stats.byPriority[p] ?? 0));

  const cards = [
    { label: "Total issues", value: stats.total, icon: Layers, tint: "text-task bg-task/10" },
    {
      label: "In progress",
      value: stats.inProgress,
      icon: Loader2,
      tint: "text-priority-high bg-priority-high/10",
    },
    { label: "Done", value: stats.done, icon: CheckCircle2, tint: "text-story bg-story/10" },
    {
      label: "Completion",
      value: `${stats.completion}%`,
      icon: TrendingUp,
      tint: "text-primary bg-primary/10",
    },
  ];

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-6 py-5">
      <div className="mb-6">
        <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading…" : "Project overview"}
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
                <div
                  className={cn(
                    "mb-3 flex h-8 w-8 items-center justify-center rounded-lg",
                    c.tint,
                  )}
                >
                  <c.icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-4 font-semibold">By status</h3>
              <div className="space-y-2.5">
                {statuses.map((s) => (
                  <Bar
                    key={s}
                    label={STATUS_LABELS[s]}
                    value={stats.byStatus[s] ?? 0}
                    max={maxStatus}
                    className={STATUS_BAR[s]}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-4 font-semibold">By priority</h3>
              <div className="space-y-2.5">
                {priorities.map((p) => (
                  <Bar
                    key={p}
                    label={p[0]!.toUpperCase() + p.slice(1)}
                    value={stats.byPriority[p] ?? 0}
                    max={maxPriority}
                    className={PRIORITY_BAR[p]}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm md:col-span-2">
              <h3 className="mb-4 font-semibold">By type</h3>
              <div className="space-y-2.5">
                {types.map((t) => (
                  <Bar
                    key={t}
                    label={t[0]!.toUpperCase() + t.slice(1)}
                    value={stats.byType[t] ?? 0}
                    max={maxType}
                    className={TYPE_BAR[t]}
                  />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
