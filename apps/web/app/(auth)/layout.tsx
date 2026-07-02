import Link from "next/link";
import { KanbanSquare, Rocket, Radio, ShieldCheck } from "lucide-react";

const HIGHLIGHTS = [
  { icon: KanbanSquare, title: "Drag-and-drop boards", desc: "Real-time Kanban that updates live over WebSockets." },
  { icon: Rocket, title: "Sprints & backlog", desc: "Plan, start and complete sprints with burndown." },
  { icon: Radio, title: "Live collaboration", desc: "See changes the moment your teammates make them." },
  { icon: ShieldCheck, title: "Self-hosted on Kubernetes", desc: "GitOps, observability and TLS — all yours." },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — hidden on small screens. */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.15), transparent 45%)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur">
            🦥
          </span>
          <span className="text-xl font-bold tracking-tight">Clever Sloth</span>
        </Link>

        <div className="relative">
          <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            Project tracking that doesn&apos;t get in your way.
          </h1>
          <div className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                  <h.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{h.title}</p>
                  <p className="text-sm text-primary-foreground/70">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Clever Sloth · Built by Nithin Pasula
        </p>
      </div>

      {/* Form panel. */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-sm">
            🦥
          </span>
          <span className="text-2xl font-bold tracking-tight">Clever Sloth</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
