"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Trash2,
  History,
  Paperclip,
  Upload,
  X,
} from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TypeBadge, PriorityBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { relativeTime } from "@/lib/time";
import type {
  Activity,
  Attachment,
  Comment,
  Issue,
  IssuePriority,
  IssueStatus,
} from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};
const STATUSES = Object.keys(STATUS_LABELS) as IssueStatus[];
const PRIORITIES: IssuePriority[] = ["critical", "high", "medium", "low"];

function activityText(a: Activity): string {
  if (a.field === "assignee") return "changed the assignee";
  const to = a.newValue.replace(/_/g, " ");
  const from = a.oldValue.replace(/_/g, " ");
  return `changed ${a.field} from ${from || "none"} to ${to}`;
}

export function IssueDetail({
  issue,
  onClose,
  onChange,
  onDelete,
}: {
  issue: Issue;
  onClose: () => void;
  onChange: (issue: Issue) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load comments + activity + attachments whenever the open issue changes.
  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description);
    (async () => {
      const [cs, as, ats] = await Promise.all([
        apiGet<Comment[]>(`/issues/${issue.id}/comments`),
        apiGet<Activity[]>(`/issues/${issue.id}/activity`),
        apiGet<Attachment[]>(`/issues/${issue.id}/attachments`),
      ]);
      setComments(cs);
      setActivities(as);
      setAttachments(ats);
    })();
  }, [issue.id, issue.title, issue.description]);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      // 1. ask the API for a presigned upload URL + attachment record
      const res = await apiPost<{ attachment: Attachment; uploadUrl: string }>(
        `/issues/${issue.id}/attachments`,
        { fileName: file.name, contentType: file.type, size: file.size },
      );
      // 2. upload the bytes straight to MinIO (not through our API)
      await fetch(res.uploadUrl, { method: "PUT", body: file });
      setAttachments((prev) => [...prev, res.attachment]);
      toast.success("File attached");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function downloadAttachment(att: Attachment) {
    const res = await apiGet<{ url: string }>(`/attachments/${att.id}/download`);
    window.open(res.url, "_blank");
  }

  async function removeAttachment(att: Attachment) {
    await apiDelete(`/attachments/${att.id}`).catch(() => {});
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  async function patch(body: Partial<Issue>) {
    const updated = await apiPatch<Issue>(`/issues/${issue.id}`, body);
    onChange(updated);
    // changing status/priority may have added an activity row — refresh it
    setActivities(await apiGet<Activity[]>(`/issues/${issue.id}/activity`));
  }

  async function saveTitle() {
    if (title.trim() && title !== issue.title) await patch({ title });
  }
  async function saveDescription() {
    if (description !== issue.description) await patch({ description });
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const c = await apiPost<Comment>(`/issues/${issue.id}/comments`, {
        body: newComment,
      });
      setComments((prev) => [...prev, c]);
      setNewComment("");
    } finally {
      setPosting(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${issue.key}? This can't be undone.`)) return;
    await apiDelete(`/issues/${issue.id}`).catch(() => {});
    toast.success(`${issue.key} deleted`);
    onDelete(issue.id);
  }

  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <div className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex items-center gap-3">
          <TypeBadge type={issue.type} />
          <span className="font-mono text-sm text-muted-foreground">{issue.key}</span>
          <span className="text-muted-foreground/40">·</span>
          <PriorityBadge priority={issue.priority} />
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="w-full rounded-md bg-transparent text-xl font-semibold outline-none focus:bg-muted/40 focus:px-2 focus:py-1"
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={issue.status}
              onChange={(e) => patch({ status: e.target.value as IssueStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={issue.priority}
              onChange={(e) => patch({ priority: e.target.value as IssuePriority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0]!.toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Add a description…"
            className="min-h-24"
          />
        </div>

        {/* Attachments */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
          </h3>
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
            >
              <button
                onClick={() => downloadAttachment(a)}
                className="flex-1 truncate text-left hover:underline"
              >
                {a.fileName}
              </button>
              <span className="text-xs text-muted-foreground">
                {formatSize(a.size)}
              </span>
              <button
                onClick={() => removeAttachment(a)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload file"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {/* Comments */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
          </h3>
          {comments.map((c) => (
            <div key={c.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap">{c.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {relativeTime(c.createdAt)}
              </p>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment…"
            />
            <Button type="submit" disabled={posting || !newComment.trim()}>
              {posting ? "…" : "Send"}
            </Button>
          </form>
        </div>

        {/* Activity */}
        {activities.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" /> Activity
            </h3>
            <ul className="space-y-1.5">
              {activities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  <span>Someone {activityText(a)}</span>
                  <span className="opacity-60">· {relativeTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end border-t pt-4">
          <Button variant="destructive" size="sm" onClick={remove}>
            <Trash2 className="h-4 w-4" />
            Delete issue
          </Button>
        </div>
      </div>
    </Modal>
  );
}
