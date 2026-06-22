"use client";

import { use, useEffect, useMemo, useState } from "react";

import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Issue, IssuePriority, IssueStatus, IssueType } from "@/lib/types";

const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
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
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", className ?? "bg-primary")}
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

  if (loading) {
    return <p className="px-6 py-5 text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  const cards = [
    { label: "Total issues", value: stats.total },
    { label: "In progress", value: stats.inProgress },
    { label: "Done", value: stats.done },
    { label: "Completion", value: `${stats.completion}%` },
  ];

  const statuses: IssueStatus[] = ["todo", "in_progress", "in_review", "done"];
  const types: IssueType[] = ["epic", "story", "task", "subtask", "bug"];
  const priorities: IssuePriority[] = ["critical", "high", "medium", "low"];
  const maxStatus = Math.max(1, ...statuses.map((s) => stats.byStatus[s] ?? 0));
  const maxType = Math.max(1, ...types.map((t) => stats.byType[t] ?? 0));
  const maxPriority = Math.max(1, ...priorities.map((p) => stats.byPriority[p] ?? 0));

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-6 py-5">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 font-semibold">By status</h3>
          <div className="space-y-2.5">
            {statuses.map((s) => (
              <Bar
                key={s}
                label={STATUS_LABELS[s]}
                value={stats.byStatus[s] ?? 0}
                max={maxStatus}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h3 className="mb-4 font-semibold">By priority</h3>
          <div className="space-y-2.5">
            {priorities.map((p) => (
              <Bar
                key={p}
                label={p[0]!.toUpperCase() + p.slice(1)}
                value={stats.byPriority[p] ?? 0}
                max={maxPriority}
                className={p === "critical" ? "bg-bug" : "bg-primary"}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 md:col-span-2">
          <h3 className="mb-4 font-semibold">By type</h3>
          <div className="space-y-2.5">
            {types.map((t) => (
              <Bar
                key={t}
                label={t[0]!.toUpperCase() + t.slice(1)}
                value={stats.byType[t] ?? 0}
                max={maxType}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
