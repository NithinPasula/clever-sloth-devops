"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

/**
 * App-wide toast host. Mounted once in the root layout. Uses sonner with rich
 * colors for success/error and follows the active (next-themes) color scheme.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "light"}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        style: { fontFamily: "var(--font-sans)", borderRadius: "0.5rem" },
      }}
    />
  );
}

export { toast } from "sonner";
