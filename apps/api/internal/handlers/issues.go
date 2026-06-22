package handlers

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

// Allowed enum values. Validating here keeps bad data out of the DB.
var (
	validIssueTypes = map[string]bool{"epic": true, "story": true, "task": true, "subtask": true, "bug": true}
	validPriorities = map[string]bool{"critical": true, "high": true, "medium": true, "low": true}
	validStatuses   = map[string]bool{"todo": true, "in_progress": true, "in_review": true, "done": true}
)

// boardColumns is the fixed, ordered set of board columns (workflow).
var boardColumns = []string{"todo", "in_progress", "in_review", "done"}

type createIssueRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Type        string     `json:"type"`
	Priority    string     `json:"priority"`
	AssigneeID  *uuid.UUID `json:"assigneeId"`
	SprintID    *uuid.UUID `json:"sprintId"`
	ParentID    *uuid.UUID `json:"parentId"`
	StoryPoints *int       `json:"storyPoints"`
}

type updateIssueRequest struct {
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Type        *string    `json:"type"`
	Status      *string    `json:"status"`
	Priority    *string    `json:"priority"`
	AssigneeID  *uuid.UUID `json:"assigneeId"`
	SprintID    *uuid.UUID `json:"sprintId"`
	StoryPoints *int       `json:"storyPoints"`
	Rank        *float64   `json:"rank"`
}

// CreateIssue creates an issue and assigns it the next key for the project
// (e.g. "CS-1", "CS-2"). The number is allocated by atomically incrementing the
// project's IssueSeq under a row lock, so two concurrent creates never collide.
func (h *Handler) CreateIssue(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	if _, _, ferr := h.loadProjectForMember(c, projID); ferr != nil {
		return ferr
	}

	var req createIssueRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return fiber.NewError(fiber.StatusBadRequest, "title is required")
	}
	if req.Type == "" {
		req.Type = "task"
	}
	if !validIssueTypes[req.Type] {
		return fiber.NewError(fiber.StatusBadRequest, "invalid issue type")
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}
	if !validPriorities[req.Priority] {
		return fiber.NewError(fiber.StatusBadRequest, "invalid priority")
	}

	userID := middleware.UserID(c)
	var issue models.Issue
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		// Lock the project row so the counter increment is race-free.
		var p models.Project
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&p, "id = ?", projID).Error; err != nil {
			return err
		}
		next := p.IssueSeq + 1
		if err := tx.Model(&p).Update("issue_seq", next).Error; err != nil {
			return err
		}
		issue = models.Issue{
			ProjectID:   projID,
			Number:      next,
			Key:         fmt.Sprintf("%s-%d", p.Key, next),
			Title:       req.Title,
			Description: req.Description,
			Type:        req.Type,
			Status:      "todo",
			Priority:    req.Priority,
			ReporterID:  userID,
			AssigneeID:  req.AssigneeID,
			SprintID:    req.SprintID,
			ParentID:    req.ParentID,
			StoryPoints: req.StoryPoints,
			// Default rank spaces issues 1000 apart so we can insert between
			// them later (drag-and-drop reordering) without renumbering.
			Rank: float64(next) * 1000,
		}
		return tx.Create(&issue).Error
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not create issue")
	}
	h.broadcast(projID, "issue.created", issue) // live board update
	return c.Status(fiber.StatusCreated).JSON(issue)
}

// ListIssues returns issues in a project, filterable via query params:
// ?status=&type=&priority=&assigneeId=&sprintId=&q=
func (h *Handler) ListIssues(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	if _, _, ferr := h.loadProjectForMember(c, projID); ferr != nil {
		return ferr
	}

	q := h.DB.Where("project_id = ?", projID)
	if v := c.Query("status"); v != "" {
		q = q.Where("status = ?", v)
	}
	if v := c.Query("type"); v != "" {
		q = q.Where("type = ?", v)
	}
	if v := c.Query("priority"); v != "" {
		q = q.Where("priority = ?", v)
	}
	if v := c.Query("assigneeId"); v != "" {
		q = q.Where("assignee_id = ?", v)
	}
	if v := c.Query("sprintId"); v != "" {
		q = q.Where("sprint_id = ?", v)
	}
	if v := c.Query("q"); v != "" {
		q = q.Where("title ILIKE ?", "%"+v+"%")
	}

	var issues []models.Issue
	q.Order("rank asc").Find(&issues)
	return c.JSON(issues)
}

// GetBoard returns issues grouped into the fixed workflow columns, each ordered
// by rank — exactly the shape the Kanban UI needs.
func (h *Handler) GetBoard(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	if _, _, ferr := h.loadProjectForMember(c, projID); ferr != nil {
		return ferr
	}

	var issues []models.Issue
	h.DB.Where("project_id = ?", projID).Order("rank asc").Find(&issues)

	board := map[string][]models.Issue{}
	for _, col := range boardColumns {
		board[col] = []models.Issue{} // ensure empty columns serialize as []
	}
	for _, is := range issues {
		board[is.Status] = append(board[is.Status], is)
	}
	return c.JSON(fiber.Map{"columns": boardColumns, "issues": board})
}

// GetIssue returns one issue (caller must be a member of its project).
func (h *Handler) GetIssue(c *fiber.Ctx) error {
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}
	return c.JSON(issue)
}

// UpdateIssue patches an issue and records an activity row for meaningful field
// changes (status / priority / assignee) — the audit trail.
func (h *Handler) UpdateIssue(c *fiber.Ctx) error {
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}

	var req updateIssueRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	userID := middleware.UserID(c)
	updates := map[string]any{}
	var activities []models.Activity
	logChange := func(field, oldV, newV string) {
		activities = append(activities, models.Activity{
			IssueID: issue.ID, ActorID: userID, Field: field, OldValue: oldV, NewValue: newV,
		})
	}

	if req.Title != nil {
		updates["title"] = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		if !validIssueTypes[*req.Type] {
			return fiber.NewError(fiber.StatusBadRequest, "invalid issue type")
		}
		updates["type"] = *req.Type
	}
	if req.Status != nil {
		if !validStatuses[*req.Status] {
			return fiber.NewError(fiber.StatusBadRequest, "invalid status")
		}
		if *req.Status != issue.Status {
			logChange("status", issue.Status, *req.Status)
		}
		updates["status"] = *req.Status
	}
	if req.Priority != nil {
		if !validPriorities[*req.Priority] {
			return fiber.NewError(fiber.StatusBadRequest, "invalid priority")
		}
		if *req.Priority != issue.Priority {
			logChange("priority", issue.Priority, *req.Priority)
		}
		updates["priority"] = *req.Priority
	}
	if req.AssigneeID != nil {
		logChange("assignee", uuidStr(issue.AssigneeID), req.AssigneeID.String())
		updates["assignee_id"] = *req.AssigneeID
	}
	if req.SprintID != nil {
		updates["sprint_id"] = *req.SprintID
	}
	if req.StoryPoints != nil {
		updates["story_points"] = *req.StoryPoints
	}
	if req.Rank != nil {
		updates["rank"] = *req.Rank
	}

	if len(updates) > 0 {
		err := h.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(issue).Updates(updates).Error; err != nil {
				return err
			}
			if len(activities) > 0 {
				return tx.Create(&activities).Error
			}
			return nil
		})
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "could not update issue")
		}
	}

	h.DB.First(issue, "id = ?", issue.ID) // reload with fresh values
	h.broadcast(issue.ProjectID, "issue.updated", issue)
	return c.JSON(issue)
}

// DeleteIssue removes an issue. Allowed for project admins/owners or the
// original reporter.
func (h *Handler) DeleteIssue(c *fiber.Ctx) error {
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}
	_, role, _ := h.loadProjectForMember(c, issue.ProjectID)
	if !roleAtLeast(role, "admin") && issue.ReporterID != middleware.UserID(c) {
		return fiber.NewError(fiber.StatusForbidden, "only an admin or the reporter can delete this issue")
	}
	if err := h.DB.Delete(issue).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not delete issue")
	}
	h.broadcast(issue.ProjectID, "issue.deleted", fiber.Map{"id": issue.ID, "key": issue.Key})
	return c.SendStatus(fiber.StatusNoContent)
}

// ListActivity returns an issue's change history (audit log), newest first.
func (h *Handler) ListActivity(c *fiber.Ctx) error {
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}
	var activities []models.Activity
	h.DB.Where("issue_id = ?", issue.ID).Order("created_at desc").Find(&activities)
	return c.JSON(activities)
}

// loadIssueForMember loads the :issueId from the path and verifies the caller is
// a member of the owning project. Shared by all single-issue handlers.
func (h *Handler) loadIssueForMember(c *fiber.Ctx) (*models.Issue, error) {
	issueID, err := uuid.Parse(c.Params("issueId"))
	if err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "invalid issue id")
	}
	var issue models.Issue
	if err := h.DB.First(&issue, "id = ?", issueID).Error; err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "issue not found")
	}
	if _, _, ferr := h.loadProjectForMember(c, issue.ProjectID); ferr != nil {
		return nil, ferr
	}
	return &issue, nil
}
