"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import {
  FolderKanban,
  KanbanSquare,
  ListTodo,
  Rocket,
  LayoutDashboard,
  Moon,
  Sun,
  Search,
} from "lucide-react";

import { apiGet } from "@/lib/api";
import type { Project, Workspace } from "@/lib/types";

/**
 * Global ⌘K / Ctrl-K command palette. Opens on the keyboard shortcut or when
 * `open` is driven by the top-bar search button. Offers quick navigation, jump
 * to any project, and a theme toggle.
 */
export function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);

  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;

  // Toggle on ⌘K / Ctrl-K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Lazy-load projects the first time the palette opens.
  useEffect(() => {
    if (!open || projects.length) return;
    (async () => {
      try {
        const workspaces = await apiGet<Workspace[]>("/workspaces");
        const ws = workspaces[0];
        if (ws) setProjects(await apiGet<Project[]>(`/workspaces/${ws.id}/projects`));
      } catch {
        /* ignore */
      }
    })();
  }, [open, projects.length]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      overlayClassName="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] animate-overlay"
      contentClassName="fixed left-1/2 top-[18%] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 animate-content overflow-hidden rounded-xl border bg-card shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Command.Input
          placeholder="Search or jump to…"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
          No results found.
        </Command.Empty>

        <Command.Group
          heading="Go to"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <PaletteItem onSelect={() => go("/projects")} icon={FolderKanban}>
            Projects
          </PaletteItem>
          {projectId && (
            <>
              <PaletteItem onSelect={() => go(`/projects/${projectId}`)} icon={KanbanSquare}>
                Board
              </PaletteItem>
              <PaletteItem
                onSelect={() => go(`/projects/${projectId}/backlog`)}
                icon={ListTodo}
              >
                Backlog
              </PaletteItem>
              <PaletteItem
                onSelect={() => go(`/projects/${projectId}/sprints`)}
                icon={Rocket}
              >
                Sprints
              </PaletteItem>
              <PaletteItem
                onSelect={() => go(`/projects/${projectId}/dashboard`)}
                icon={LayoutDashboard}
              >
                Dashboard
              </PaletteItem>
            </>
          )}
        </Command.Group>

        {projects.length > 0 && (
          <Command.Group
            heading="Projects"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {projects.map((p) => (
              <PaletteItem
                key={p.id}
                value={`project ${p.key} ${p.name}`}
                onSelect={() => go(`/projects/${p.id}`)}
                icon={FolderKanban}
              >
                <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
                {p.name}
              </PaletteItem>
            ))}
          </Command.Group>
        )}

        <Command.Group
          heading="Preferences"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <PaletteItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
            icon={resolvedTheme === "dark" ? Sun : Moon}
          >
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
          </PaletteItem>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function PaletteItem({
  children,
  icon: Icon,
  onSelect,
  value,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  value?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {children}
    </Command.Item>
  );
}
