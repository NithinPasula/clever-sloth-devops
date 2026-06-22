package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

type createSprintRequest struct {
	Name      string     `json:"name"`
	Goal      string     `json:"goal"`
	StartDate *time.Time `json:"startDate"`
	EndDate   *time.Time `json:"endDate"`
}

type updateSprintRequest struct {
	Name      *string    `json:"name"`
	Goal      *string    `json:"goal"`
	StartDate *time.Time `json:"startDate"`
	EndDate   *time.Time `json:"endDate"`
}

// CreateSprint creates a planned sprint in a project.
func (h *Handler) CreateSprint(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	if _, _, ferr := h.loadProjectForMember(c, projID); ferr != nil {
		return ferr
	}
	var req createSprintRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "sprint name is required")
	}
	sprint := models.Sprint{
		ProjectID: projID,
		Name:      req.Name,
		Goal:      req.Goal,
		Status:    "planned",
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
	}
	if err := h.DB.Create(&sprint).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not create sprint")
	}
	return c.Status(fiber.StatusCreated).JSON(sprint)
}

// ListSprints lists a project's sprints.
func (h *Handler) ListSprints(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	if _, _, ferr := h.loadProjectForMember(c, projID); ferr != nil {
		return ferr
	}
	var sprints []models.Sprint
	h.DB.Where("project_id = ?", projID).Order("created_at asc").Find(&sprints)
	return c.JSON(sprints)
}

// UpdateSprint edits sprint fields.
func (h *Handler) UpdateSprint(c *fiber.Ctx) error {
	sprint, ferr := h.loadSprintForMember(c)
	if ferr != nil {
		return ferr
	}
	var req updateSprintRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Goal != nil {
		updates["goal"] = *req.Goal
	}
	if req.StartDate != nil {
		updates["start_date"] = *req.StartDate
	}
	if req.EndDate != nil {
		updates["end_date"] = *req.EndDate
	}
	if len(updates) > 0 {
		h.DB.Model(sprint).Updates(updates)
	}
	h.DB.First(sprint, "id = ?", sprint.ID)
	return c.JSON(sprint)
}

// StartSprint activates a sprint (and stamps its start date if unset).
func (h *Handler) StartSprint(c *fiber.Ctx) error {
	sprint, ferr := h.loadSprintForMember(c)
	if ferr != nil {
		return ferr
	}
	updates := map[string]any{"status": "active"}
	if sprint.StartDate == nil {
		updates["start_date"] = time.Now()
	}
	h.DB.Model(sprint).Updates(updates)
	h.DB.First(sprint, "id = ?", sprint.ID)
	return c.JSON(sprint)
}

// CompleteSprint closes a sprint. Any unfinished issues are moved back to the
// backlog (sprint_id cleared), mirroring how Jira ends a sprint.
func (h *Handler) CompleteSprint(c *fiber.Ctx) error {
	sprint, ferr := h.loadSprintForMember(c)
	if ferr != nil {
		return ferr
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Issue{}).
			Where("sprint_id = ? AND status <> ?", sprint.ID, "done").
			Update("sprint_id", nil).Error; err != nil {
			return err
		}
		return tx.Model(sprint).Updates(map[string]any{"status": "completed", "end_date": time.Now()}).Error
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not complete sprint")
	}
	h.DB.First(sprint, "id = ?", sprint.ID)
	return c.JSON(sprint)
}

// loadSprintForMember loads the :sprintId and verifies project membership.
func (h *Handler) loadSprintForMember(c *fiber.Ctx) (*models.Sprint, error) {
	sprintID, err := uuid.Parse(c.Params("sprintId"))
	if err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "invalid sprint id")
	}
	var sprint models.Sprint
	if err := h.DB.First(&sprint, "id = ?", sprintID).Error; err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "sprint not found")
	}
	if _, _, ferr := h.loadProjectForMember(c, sprint.ProjectID); ferr != nil {
		return nil, ferr
	}
	return &sprint, nil
}
