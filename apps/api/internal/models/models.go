// Package models defines the database schema as GORM structs.
//
// One struct == one table. We use UUID primary keys (generated in Go, so we
// don't depend on a Postgres extension) and a shared Base for id/timestamps.
// All() returns every model so AutoMigrate can create/update the schema.
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Base is embedded in every model: UUID primary key + audit timestamps.
type Base struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// BeforeCreate generates a UUID if one wasn't set explicitly.
func (b *Base) BeforeCreate(_ *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// ---- Identity & tenancy ----

// User is a person who can log in.
type User struct {
	Base
	Email        string `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"not null" json:"-"` // never serialized to JSON
	Name         string `json:"name"`
	AvatarURL    string `json:"avatarUrl"`
}

// Workspace is the top-level tenant boundary (like a Jira "site"/org).
type Workspace struct {
	Base
	Name    string    `gorm:"not null" json:"name"`
	Slug    string    `gorm:"uniqueIndex;not null" json:"slug"`
	OwnerID uuid.UUID `gorm:"type:uuid;index" json:"ownerId"`
}

// WorkspaceMember links a user to a workspace with a role.
type WorkspaceMember struct {
	Base
	WorkspaceID uuid.UUID `gorm:"type:uuid;index:idx_ws_user,unique" json:"workspaceId"`
	UserID      uuid.UUID `gorm:"type:uuid;index:idx_ws_user,unique" json:"userId"`
	Role        string    `gorm:"default:member" json:"role"` // admin | member
}

// ---- Projects ----

// Project groups issues, sprints and labels. Key (e.g. "CS") prefixes issue keys.
type Project struct {
	Base
	WorkspaceID uuid.UUID `gorm:"type:uuid;index" json:"workspaceId"`
	Key         string    `gorm:"index;not null" json:"key"` // e.g. "CS"
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	LeadID      *uuid.UUID `gorm:"type:uuid" json:"leadId"`
	IssueSeq    int       `gorm:"default:0" json:"-"` // running counter for issue numbers
	Archived    bool      `gorm:"default:false" json:"archived"`
}

// ProjectMember links a user to a project with a role.
type ProjectMember struct {
	Base
	ProjectID uuid.UUID `gorm:"type:uuid;index:idx_proj_user,unique" json:"projectId"`
	UserID    uuid.UUID `gorm:"type:uuid;index:idx_proj_user,unique" json:"userId"`
	Role      string    `gorm:"default:member" json:"role"` // owner | admin | member | viewer
}

// ---- Sprints & issues ----

// Sprint is a time-boxed iteration within a project.
type Sprint struct {
	Base
	ProjectID uuid.UUID  `gorm:"type:uuid;index" json:"projectId"`
	Name      string     `gorm:"not null" json:"name"`
	Goal      string     `json:"goal"`
	Status    string     `gorm:"default:planned" json:"status"` // planned | active | completed
	StartDate *time.Time `json:"startDate"`
	EndDate   *time.Time `json:"endDate"`
}

// Issue is the core work item: epic, story, task, sub-task or bug.
type Issue struct {
	Base
	ProjectID   uuid.UUID  `gorm:"type:uuid;index" json:"projectId"`
	Number      int        `gorm:"index" json:"number"`        // e.g. 123
	Key         string     `gorm:"index" json:"key"`           // e.g. "CS-123"
	Title       string     `gorm:"not null" json:"title"`
	Description string     `json:"description"`                 // rich text (HTML/JSON from Tiptap)
	Type        string     `gorm:"default:task" json:"type"`    // epic | story | task | subtask | bug
	Status      string     `gorm:"default:todo;index" json:"status"` // todo | in_progress | in_review | done
	Priority    string     `gorm:"default:medium" json:"priority"`   // critical | high | medium | low
	ReporterID  uuid.UUID  `gorm:"type:uuid;index" json:"reporterId"`
	AssigneeID  *uuid.UUID `gorm:"type:uuid;index" json:"assigneeId"`
	SprintID    *uuid.UUID `gorm:"type:uuid;index" json:"sprintId"`
	ParentID    *uuid.UUID `gorm:"type:uuid;index" json:"parentId"` // epic link / subtask parent
	StoryPoints *int       `json:"storyPoints"`
	Rank        float64    `gorm:"index" json:"rank"` // board/backlog ordering
}

// Label is a colored tag scoped to a project.
type Label struct {
	Base
	ProjectID uuid.UUID `gorm:"type:uuid;index" json:"projectId"`
	Name      string    `gorm:"not null" json:"name"`
	Color     string    `gorm:"default:#6366f1" json:"color"`
}

// IssueLabel is the many-to-many join between issues and labels.
type IssueLabel struct {
	Base
	IssueID uuid.UUID `gorm:"type:uuid;index:idx_issue_label,unique" json:"issueId"`
	LabelID uuid.UUID `gorm:"type:uuid;index:idx_issue_label,unique" json:"labelId"`
}

// IssueLink expresses a relationship between two issues.
type IssueLink struct {
	Base
	SourceIssueID uuid.UUID `gorm:"type:uuid;index" json:"sourceIssueId"`
	TargetIssueID uuid.UUID `gorm:"type:uuid;index" json:"targetIssueId"`
	Type          string    `json:"type"` // blocks | blocked_by | relates | duplicates
}

// ---- Collaboration ----

// Comment is a message on an issue (supports @mentions in the body).
type Comment struct {
	Base
	IssueID  uuid.UUID `gorm:"type:uuid;index" json:"issueId"`
	AuthorID uuid.UUID `gorm:"type:uuid;index" json:"authorId"`
	Body     string    `gorm:"not null" json:"body"`
}

// Activity is an immutable audit record of a field change on an issue.
type Activity struct {
	Base
	IssueID  uuid.UUID `gorm:"type:uuid;index" json:"issueId"`
	ActorID  uuid.UUID `gorm:"type:uuid;index" json:"actorId"`
	Field    string    `json:"field"`    // e.g. "status", "assignee"
	OldValue string    `json:"oldValue"`
	NewValue string    `json:"newValue"`
}

// Attachment is a file stored in MinIO, referenced by ObjectKey.
type Attachment struct {
	Base
	IssueID     uuid.UUID `gorm:"type:uuid;index" json:"issueId"`
	UploaderID  uuid.UUID `gorm:"type:uuid;index" json:"uploaderId"`
	FileName    string    `json:"fileName"`
	ObjectKey   string    `json:"objectKey"` // key within the MinIO bucket
	Size        int64     `json:"size"`
	ContentType string    `json:"contentType"`
}

// Notification is an in-app notification for a user.
type Notification struct {
	Base
	UserID     uuid.UUID  `gorm:"type:uuid;index" json:"userId"`
	Type       string     `json:"type"` // assigned | mentioned | commented | ...
	Title      string     `json:"title"`
	Body       string     `json:"body"`
	EntityType string     `json:"entityType"` // "issue", "comment", ...
	EntityID   *uuid.UUID `gorm:"type:uuid" json:"entityId"`
	ReadAt     *time.Time `json:"readAt"`
}

// All returns every model, used by AutoMigrate to build the schema.
func All() []any {
	return []any{
		&User{},
		&Workspace{},
		&WorkspaceMember{},
		&Project{},
		&ProjectMember{},
		&Sprint{},
		&Issue{},
		&Label{},
		&IssueLabel{},
		&IssueLink{},
		&Comment{},
		&Activity{},
		&Attachment{},
		&Notification{},
	}
}
