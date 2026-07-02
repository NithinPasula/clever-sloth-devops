"use client";

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

import { IssueCard } from "./issue-card";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/types";

/**
 * A board card wired for Pragmatic Drag and Drop. It is BOTH:
 *   - a draggable (you can pick it up), and
 *   - a drop target (so we can show a precise insertion line above/below it,
 *     using the hitbox "closest edge" helper — the Trello/Jira behaviour).
 */
export function BoardCard({
  issue,
  onClick,
}: {
  issue: Issue;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({
          type: "card",
          cardId: issue.id,
          status: issue.status,
        }),
        onDragStart: () => {
          setDragging(true);
          document.body.classList.add("dragging-cursor");
        },
        onDrop: () => {
          setDragging(false);
          document.body.classList.remove("dragging-cursor");
        },
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.type === "card",
        getData: ({ input }) =>
          attachClosestEdge(
            { type: "card", cardId: issue.id, status: issue.status },
            { element: el, input, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self, source }) => {
          // Don't draw an indicator against the card being dragged itself.
          if (source.data.cardId === issue.id) {
            setEdge(null);
            return;
          }
          setEdge(extractClosestEdge(self.data));
        },
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    );
  }, [issue.id, issue.status]);

  return (
    <div ref={ref} className="relative">
      {edge && <DropIndicator edge={edge} />}
      <IssueCard issue={issue} onClick={onClick} dragging={dragging} />
    </div>
  );
}

/** The animated insertion line shown between cards. */
function DropIndicator({ edge }: { edge: Edge }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex items-center",
        edge === "top" ? "-top-[5px]" : "-bottom-[5px]",
      )}
    >
      <div className="h-2 w-2 -ml-0.5 shrink-0 rounded-full border-2 border-primary bg-card" />
      <div className="h-0.5 flex-1 rounded-full bg-primary" />
    </div>
  );
}
