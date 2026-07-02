"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { CreateIssueModal } from "@/components/board/create-issue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TypeBadge, PriorityBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch } from "@/lib/api";
import type { Issue, IssueStatus, Sprint } from "@/lib/types";

const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};
const STATUSES = Object.keys(STATUS_LABELS) as IssueStatus[];

export default function BacklogPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [is, sp] = await Promise.all([
          apiGet<Issue[]>(`/projects/${projectId}/issues`),
          apiGet<Sprint[]>(`/projects/${projectId}/sprints`),
        ]);
        setIssues(is);
        setSprints(sp);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // Backlog = issues not assigned to any sprint, filtered by the search box.
  const backlog = useMemo(() => {
    const term = q.trim().toLowerCase();
    return issues
      .filter((i) => !i.sprintId)
      .filter((i) => !term || i.title.toLowerCase().includes(term) || i.key.toLowerCase().includes(term));
  }, [issues, q]);

  async function assignSprint(issue: Issue, sprintId: string) {
    if (!sprintId) return;
    setIssues((prev) =>
      prev.map((i) => (i.id === issue.id ? { ...i, sprintId } : i)),
    );
    await apiPatch(`/issues/${issue.id}`, { sprintId }).catch(() => {});
  }

  async function changeStatus(issue: Issue, status: IssueStatus) {
    setIssues((prev) =>
      prev.map((i) => (i.id === issue.id ? { ...i, status } : i)),
    );
    await apiPatch(`/issues/${issue.id}`, { status }).catch(() => {});
  }

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-6 py-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Backlog</h1>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : `${backlog.length} issue${backlog.length === 1 ? "" : "s"} · not in a sprint`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New issue
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search backlog…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : backlog.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {q ? "No matching issues." : "Backlog is empty — create your first issue."}
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {backlog.map((issue) => (
            <li
              key={issue.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <TypeBadge type={issue.type} />
              <span className="font-mono text-xs text-muted-foreground">
                {issue.key}
              </span>
              <span className="flex-1 truncate text-sm font-medium">
                {issue.title}
              </span>
              <PriorityBadge priority={issue.priority} />
              <Select
                value={issue.status}
                onChange={(e) => changeStatus(issue, e.target.value as IssueStatus)}
                className="h-8 w-32 text-xs"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
              <Select
                value=""
                onChange={(e) => assignSprint(issue, e.target.value)}
                className="h-8 w-36 text-xs"
                disabled={sprints.length === 0}
              >
                <option value="">
                  {sprints.length ? "→ Sprint" : "No sprints"}
                </option>
                {sprints
                  .filter((s) => s.status !== "completed")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </li>
          ))}
        </ul>
      )}

      <CreateIssueModal
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(issue) => setIssues((prev) => [issue, ...prev])}
      />
    </div>
  );
}
