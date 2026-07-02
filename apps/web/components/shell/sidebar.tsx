"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  KanbanSquare,
  ListTodo,
  Rocket,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

/** Pull the current projectId out of the path, or null when not in a project. */
function useProjectId(): string | null {
  const pathname = usePathname();
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const projectId = useProjectId();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    apiGet<Project>(`/projects/${projectId}`)
      .then(setProject)
      .catch(() => {});
  }, [projectId]);

  const projectNav = projectId
    ? [
        { href: `/projects/${projectId}`, label: "Board", icon: KanbanSquare, exact: true },
        { href: `/projects/${projectId}/backlog`, label: "Backlog", icon: ListTodo },
        { href: `/projects/${projectId}/sprints`, label: "Sprints", icon: Rocket },
        {
          href: `/projects/${projectId}/dashboard`,
          label: "Dashboard",
          icon: LayoutDashboard,
        },
      ]
    : [];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <Link
        href="/projects"
        className="flex h-14 items-center gap-2.5 border-b px-5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base text-primary-foreground shadow-sm">
          🦥
        </span>
        <span className="font-bold tracking-tight">Clever Sloth</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-3">
        <NavItem
          href="/projects"
          label="Projects"
          icon={FolderKanban}
          active={!projectId}
        />

        {projectId && (
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2 px-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/15 text-[11px] font-bold text-primary">
                {project?.key ?? "··"}
              </span>
              <span className="truncate text-sm font-semibold">
                {project?.name ?? "Loading…"}
              </span>
            </div>
            <div className="space-y-0.5">
              {projectNav.map((n) => (
                <NavItem
                  key={n.href}
                  href={n.href}
                  label={n.label}
                  icon={n.icon}
                  active={n.exact ? pathname === n.href : pathname.startsWith(n.href)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t px-5 py-3 text-xs text-muted-foreground">
        Clever Sloth · v0.1
      </div>
    </aside>
  );
}
