import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground shadow-sm">
          🦥
        </span>
        <span className="text-2xl font-bold tracking-tight">Clever Sloth</span>
      </Link>
      {children}
      <p className="mt-8 text-xs text-muted-foreground">
        Project tracking that doesn&apos;t get in your way.
      </p>
    </div>
  );
}
