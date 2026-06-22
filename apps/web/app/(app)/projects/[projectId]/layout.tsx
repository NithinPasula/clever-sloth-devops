"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    apiGet<Project>(`/projects/${projectId}`)
      .then(setProject)
      .catch(() => {});
  }, [projectId]);

  const tabs = [
    { href: `/projects/${projectId}`, label: "Board" },
    { href: `/projects/${projectId}/backlog`, label: "Backlog" },
    { href: `/projects/${projectId}/sprints`, label: "Sprints" },
    { href: `/projects/${projectId}/dashboard`, label: "Dashboard" },
  ];

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b px-6 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {project ? project.name : "Loading…"}
            </h1>
            {project && (
              <p className="font-mono text-xs text-muted-foreground">{project.key}</p>
            )}
          </div>
        </div>
        <nav className="mt-3 flex gap-1">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
