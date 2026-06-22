"use client";

import { use, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { BoardColumn } from "@/components/board/board-column";
import { IssueCard } from "@/components/board/issue-card";
import { IssueDetail } from "@/components/board/issue-detail";
import { CreateIssueModal } from "@/components/board/create-issue";
import { Button } from "@/components/ui/button";
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
  const [activeId, setActiveId] = useState<string | null>(null);

  const boardRef = useRef<Columns>(columns);
  boardRef.current = columns;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    document.body.classList.add("dragging-cursor");
  }

  function onDragCancel() {
    setActiveId(null);
    document.body.classList.remove("dragging-cursor");
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    document.body.classList.remove("dragging-cursor");
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const prev = boardRef.current;
    const from = findColumn(prev, activeId);
    if (!from) return;
    const to: IssueStatus = STATUSES.includes(overId as IssueStatus)
      ? (overId as IssueStatus)
      : (findColumn(prev, overId) ?? from);

    const fromItems = [...prev[from]];
    const movingIndex = fromItems.findIndex((i) => i.id === activeId);
    if (movingIndex === -1) return;
    const moving = fromItems[movingIndex]!;
    fromItems.splice(movingIndex, 1);

    const toItems = from === to ? fromItems : [...prev[to]];
    let insertAt = toItems.length;
    if (!STATUSES.includes(overId as IssueStatus)) {
      const overIndex = toItems.findIndex((i) => i.id === overId);
      if (overIndex !== -1) insertAt = overIndex;
    }
    const newRank = computeRank(toItems[insertAt - 1]?.rank, toItems[insertAt]?.rank);
    const updated: Issue = { ...moving, status: to, rank: newRank };
    toItems.splice(insertAt, 0, updated);

    setColumns(
      from === to
        ? { ...prev, [to]: toItems }
        : { ...prev, [from]: fromItems, [to]: toItems },
    );

    apiPatch(`/issues/${activeId}`, { status: to, rank: newRank }).catch(() => {});
  }

  const activeIssue = activeId
    ? STATUSES.flatMap((s) => columns[s]).find((i) => i.id === activeId)
    : null;

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Issue | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-6 py-3">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New issue
        </Button>
      </div>

      {loading ? (
        <p className="px-6 text-sm text-muted-foreground">Loading board…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto px-6 pb-6">
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
          <DragOverlay>
            {activeIssue ? (
              <div className="rotate-3 rounded-md shadow-2xl ring-2 ring-primary">
                <IssueCard issue={activeIssue} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
