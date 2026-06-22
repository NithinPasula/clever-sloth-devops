// Shared types mirroring the Go API's JSON responses.

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  leadId: string | null;
  archived: boolean;
  createdAt: string;
}

export type IssueType = "epic" | "story" | "task" | "subtask" | "bug";
export type IssueStatus = "todo" | "in_progress" | "in_review" | "done";
export type IssuePriority = "critical" | "high" | "medium" | "low";

export interface Issue {
  id: string;
  projectId: string;
  number: number;
  key: string;
  title: string;
  description: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  reporterId: string;
  assigneeId: string | null;
  sprintId: string | null;
  parentId: string | null;
  storyPoints: number | null;
  rank: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  columns: IssueStatus[];
  issues: Record<IssueStatus, Issue[]>;
}

export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  issueId: string;
  uploaderId: string;
  fileName: string;
  objectKey: string;
  size: number;
  contentType: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  issueId: string;
  actorId: string;
  field: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  status: "planned" | "active" | "completed";
  startDate: string | null;
  endDate: string | null;
}
