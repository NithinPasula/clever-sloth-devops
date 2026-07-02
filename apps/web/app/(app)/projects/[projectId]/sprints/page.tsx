"use client";

import { use, useEffect, useState } from "react";
import { Plus, Play, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Issue, Sprint } from "@/lib/types";

const STATUS_STYLES: Record<Sprint["status"], string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-story/15 text-story",
  completed: "bg-primary/15 text-primary",
};

export default function SprintsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sp, is] = await Promise.all([
          apiGet<Sprint[]>(`/projects/${projectId}/sprints`),
          apiGet<Issue[]>(`/projects/${projectId}/issues`),
        ]);
        setSprints(sp);
        setIssues(is);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const countFor = (sprintId: string) =>
    issues.filter((i) => i.sprintId === sprintId).length;
  const doneFor = (sprintId: string) =>
    issues.filter((i) => i.sprintId === sprintId && i.status === "done").length;

  async function createSprint(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const sprint = await apiPost<Sprint>(`/projects/${projectId}/sprints`, {
        name,
        goal,
      });
      setSprints((prev) => [...prev, sprint]);
      setOpen(false);
      setName("");
      setGoal("");
      toast.success(`Sprint “${sprint.name}” created`);
    } finally {
      setSaving(false);
    }
  }

  async function start(sprint: Sprint) {
    const updated = await apiPost<Sprint>(`/sprints/${sprint.id}/start`);
    setSprints((prev) => prev.map((s) => (s.id === sprint.id ? updated : s)));
    toast.success(`${sprint.name} started`);
  }

  async function complete(sprint: Sprint) {
    const updated = await apiPost<Sprint>(`/sprints/${sprint.id}/complete`);
    setSprints((prev) => prev.map((s) => (s.id === sprint.id ? updated : s)));
    // completing returns unfinished issues to the backlog — refresh issues
    setIssues(await apiGet<Issue[]>(`/projects/${projectId}/issues`));
    toast.success(`${sprint.name} completed`);
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Sprints</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${sprints.length} sprint${sprints.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New sprint
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : sprints.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No sprints yet — create one, then assign backlog issues to it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sprints.map((sprint) => {
            const total = countFor(sprint.id);
            const done = doneFor(sprint.id);
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <div
                key={sprint.id}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
                  sprint.status === "active" && "ring-1 ring-story/40",
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{sprint.name}</h3>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase",
                          STATUS_STYLES[sprint.status],
                        )}
                      >
                        {sprint.status}
                      </span>
                    </div>
                    {sprint.goal && (
                      <p className="mt-1 text-sm text-muted-foreground">{sprint.goal}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {sprint.status === "planned" && (
                      <Button size="sm" onClick={() => start(sprint)}>
                        <Play className="h-4 w-4" />
                        Start
                      </Button>
                    )}
                    {sprint.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => complete(sprint)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {done} / {total} done
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New sprint">
        <form onSubmit={createSprint} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sp-name">Name</Label>
            <Input
              id="sp-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-goal">Goal</Label>
            <Textarea
              id="sp-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What should this sprint achieve?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create sprint"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
