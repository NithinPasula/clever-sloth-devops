import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn merges Tailwind class names intelligently: clsx handles conditionals, and
 * tailwind-merge resolves conflicts (e.g. "px-2 px-4" -> "px-4"). Used by every
 * UI component for composable className overrides.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
