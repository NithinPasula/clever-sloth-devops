"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { apiPost } from "@/lib/api";
import type { Issue, IssuePriority, IssueType } from "@/lib/types";

/** Shared "New issue" modal used by both the board and the backlog. */
export function CreateIssueModal({
  projectId,
  open,
  onClose,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (issue: Issue) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<IssueType>("task");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const issue = await apiPost<Issue>(`/projects/${projectId}/issues`, {
        title,
        type,
        priority,
      });
      onCreated(issue);
      setTitle("");
      setType("task");
      setPriority("medium");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New issue">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ci-title">Title</Label>
          <Input
            id="ci-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summarize the work"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ci-type">Type</Label>
            <Select
              id="ci-type"
              value={type}
              onChange={(e) => setType(e.target.value as IssueType)}
            >
              <option value="task">Task</option>
              <option value="story">Story</option>
              <option value="bug">Bug</option>
              <option value="epic">Epic</option>
              <option value="subtask">Sub-task</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ci-priority">Priority</Label>
            <Select
              id="ci-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create issue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
