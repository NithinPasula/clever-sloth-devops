import { cn } from "@/lib/utils";

/** A shimmering placeholder block for loading states. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-[shimmer_1.4s_ease-in-out_infinite] rounded-md bg-muted", className)}
      {...props}
    />
  );
}
