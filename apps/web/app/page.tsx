"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

export default function Home() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Render only after client mount to avoid an SSR/client mismatch. Zustand's
  // localStorage persistence is synchronous, so by mount the store already
  // holds the persisted user — no separate "hydrated" gate needed.
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg text-primary-foreground shadow-sm">
            🦥
          </span>
          <span className="text-lg font-bold tracking-tight">Clever Sloth</span>
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.name || user.email}
              </span>
              <Button variant="ghost" onClick={() => logout()}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Log in</Button>
              </Link>
              <Link href="/register">
                <Button>Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Kanban · Sprints · Real-time
        </div>
        <h1 className="max-w-2xl text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Project tracking that{" "}
          <span className="text-primary">doesn&apos;t get in your way</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Plan sprints, track issues on a live Kanban board, and ship faster — a
          self-hosted Jira alternative built for teams that move.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Button size="lg" onClick={() => router.push("/projects")}>
              <LayoutDashboard className="h-4 w-4" />
              Go to your projects
            </Button>
          ) : (
            <>
              <Link href="/register">
                <Button size="lg">
                  Get started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Log in
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
