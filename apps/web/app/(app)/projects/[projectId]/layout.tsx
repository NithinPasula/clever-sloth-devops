/**
 * Project-scoped layout. Navigation (Board / Backlog / Sprints / Dashboard) now
 * lives in the app sidebar, so this simply provides a full-height container for
 * each project page to fill.
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-full">{children}</div>;
}
