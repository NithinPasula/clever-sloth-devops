"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { apiGet, apiPost } from "@/lib/api";
import type { Project, Workspace } from "@/lib/types";

export default function ProjectsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // create-form state
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const workspaces = await apiGet<Workspace[]>("/workspaces");
        const ws = workspaces[0] ?? null;
        setWorkspace(ws);
        if (ws) {
          setProjects(await apiGet<Project[]>(`/workspaces/${ws.id}/projects`));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    setError(null);
    setSaving(true);
    try {
      const project = await apiPost<Project>(
        `/workspaces/${workspace.id}/projects`,
        { key, name, description },
      );
      setProjects((prev) => [project, ...prev]);
      setOpen(false);
      setKey("");
      setName("");
      setDescription("");
      toast.success(`Project ${project.key} created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {workspace ? workspace.name : "Loading workspace…"}
            </p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!workspace}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-5">
                <Skeleton className="mb-4 h-9 w-9 rounded-md" />
                <Skeleton className="mb-2 h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <FolderKanban className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold">No projects yet</h3>
            <p className="mb-5 mt-1 max-w-sm text-sm text-muted-foreground">
              Create your first project to start tracking issues on a board.
            </p>
            <Button onClick={() => setOpen(true)} disabled={!workspace}>
              <Plus className="h-4 w-4" />
              New project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group relative rounded-lg border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-sm font-bold text-primary">
                  {p.key}
                </div>
                <h3 className="font-semibold group-hover:text-primary">{p.name}</h3>
                {p.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                ) : (
                  <p className="mt-1 text-sm italic text-muted-foreground/60">
                    No description
                  </p>
                )}
                <ArrowRight className="absolute right-5 top-5 h-4 w-4 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New project"
        description="Projects group issues, sprints and a board."
      >
        <form onSubmit={createProject} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              required
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="CS"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              2–10 letters/digits. Prefixes issue keys, e.g. {key || "CS"}-1.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clever Sloth"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
