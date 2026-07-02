"use client";

import { use, useEffect, useRef, useState } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { Plus } from "lucide-react";

import { BoardColumn } from "@/components/board/board-column";
import { IssueDetail } from "@/components/board/issue-detail";
import { CreateIssueModal } from "@/components/board/create-issue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch } from "@/lib/api";
import { boardSocketUrl } from "@/lib/ws";
import { useAuthStore } from "@/store/auth";
import type { Board, Issue, IssueStatus } from "@/lib/types";

const STATUSES: IssueStatus[] = ["todo", "in_progress", "in_review", "done"];
const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

type Columns = Record<IssueStatus, Issue[]>;
const emptyColumns = (): Columns => ({
  todo: [],
  in_progress: [],
  in_review: [],
  done: [],
});

function computeRank(before?: number, after?: number): number {
  if (before == null && after == null) return 1000;
  if (before == null) return after! - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}

function findColumn(cols: Columns, id: string): IssueStatus | null {
  return STATUSES.find((s) => cols[s].some((i) => i.id === id)) ?? null;
}

function upsertIssue(cols: Columns, issue: Issue): Columns {
  const next = emptyColumns();
  for (const s of STATUSES) next[s] = cols[s].filter((i) => i.id !== issue.id);
  next[issue.status] = [...next[issue.status], issue].sort((a, b) => a.rank - b.rank);
  return next;
}

function removeIssue(cols: Columns, id: string): Columns {
  const next = emptyColumns();
  for (const s of STATUSES) next[s] = cols[s].filter((i) => i.id !== id);
  return next;
}

export default function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const token = useAuthStore((s) => s.accessToken);

  const [columns, setColumns] = useState<Columns>(emptyColumns());
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Issue | null>(null);

  // Always-current snapshot for the drop handler (which is registered once).
  const boardRef = useRef<Columns>(columns);
  boardRef.current = columns;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const board = await apiGet<Board>(`/projects/${projectId}/board`);
        setColumns({ ...emptyColumns(), ...board.issues });
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // Live updates over the board WebSocket.
  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(boardSocketUrl(projectId, token));
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type: string; payload: unknown };
        if (event.type === "issue.deleted") {
          const { id } = event.payload as { id: string };
          setColumns((prev) => removeIssue(prev, id));
        } else if (
          event.type === "issue.created" ||
          event.type === "issue.updated"
        ) {
          setColumns((prev) => upsertIssue(prev, event.payload as Issue));
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [projectId, token]);

  // Horizontal auto-scroll when dragging near the board edges.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    return autoScrollForElements({ element: el });
  }, []);

  // Single global monitor performs the actual move on drop.
  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === "card",
      onDrop({ source, location }) {
        document.body.classList.remove("dragging-cursor");
        const targets = location.current.dropTargets;
        if (!targets.length) return;

        const cardId = source.data.cardId as string;
        const prev = boardRef.current;
        const from = findColumn(prev, cardId);
        if (!from) return;

        // Work out destination column + index from the innermost drop target.
        const top = targets[0]!;
        let to: IssueStatus;
        let insertIndex: number;
        if (top.data.type === "card") {
          to = top.data.status as IssueStatus;
          const overId = top.data.cardId as string;
          const overIndex = prev[to].findIndex((i) => i.id === overId);
          const edge = extractClosestEdge(top.data);
          insertIndex = overIndex + (edge === "bottom" ? 1 : 0);
        } else {
          to = top.data.status as IssueStatus;
          insertIndex = prev[to].length;
        }

        const fromItems = [...prev[from]];
        const movingIndex = fromItems.findIndex((i) => i.id === cardId);
        if (movingIndex === -1) return;
        const moving = fromItems[movingIndex]!;
        fromItems.splice(movingIndex, 1);

        const toItems = from === to ? fromItems : [...prev[to]];
        // Removing the card from earlier in the same list shifts the target.
        let idx = insertIndex;
        if (from === to && movingIndex < insertIndex) idx -= 1;
        idx = Math.max(0, Math.min(idx, toItems.length));

        const newRank = computeRank(toItems[idx - 1]?.rank, toItems[idx]?.rank);
        const updated: Issue = { ...moving, status: to, rank: newRank };
        toItems.splice(idx, 0, updated);

        setColumns(
          from === to
            ? { ...prev, [to]: toItems }
            : { ...prev, [from]: fromItems, [to]: toItems },
        );

        apiPatch(`/issues/${cardId}`, { status: to, rank: newRank }).catch(() => {});
      },
    });
  }, []);

  const totalIssues = STATUSES.reduce((n, s) => n + columns[s].length, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Board</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${totalIssues} issue${totalIssues === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New issue
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-1 gap-5 overflow-hidden px-6 py-5">
          {STATUSES.map((s) => (
            <div key={s} className="flex w-72 shrink-0 flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex flex-1 gap-5 overflow-x-auto px-6 py-5"
        >
          {STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              label={STATUS_LABELS[status]}
              issues={columns[status]}
              onCardClick={(issue) => setSelected(issue)}
            />
          ))}
        </div>
      )}

      <CreateIssueModal
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(issue) => setColumns((prev) => upsertIssue(prev, issue))}
      />

      {selected && (
        <IssueDetail
          issue={selected}
          onClose={() => setSelected(null)}
          onChange={(updated) => {
            setColumns((prev) => upsertIssue(prev, updated));
            setSelected(updated);
          }}
          onDelete={(id) => {
            setColumns((prev) => removeIssue(prev, id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
