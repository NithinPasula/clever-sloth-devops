package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

// projectRoleRank defines the role hierarchy within a project.
// Higher number == more privilege. roleAtLeast uses this to gate actions.
var projectRoleRank = map[string]int{
	"viewer": 1,
	"member": 2,
	"admin":  3,
	"owner":  4,
}

// roleAtLeast reports whether `role` is at least as privileged as `min`.
func roleAtLeast(role, min string) bool {
	return projectRoleRank[role] >= projectRoleRank[min]
}

// workspaceMember returns the caller's membership row for a workspace, or an
// error if they are not a member.
func (h *Handler) workspaceMember(wsID, userID uuid.UUID) (*models.WorkspaceMember, error) {
	var m models.WorkspaceMember
	if err := h.DB.Where("workspace_id = ? AND user_id = ?", wsID, userID).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// projectMember returns the caller's membership row for a project, or an error.
func (h *Handler) projectMember(projID, userID uuid.UUID) (*models.ProjectMember, error) {
	var m models.ProjectMember
	if err := h.DB.Where("project_id = ? AND user_id = ?", projID, userID).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// loadProjectForMember loads a project and verifies the caller is a member.
// It returns the project, the caller's role, and a ready-to-return fiber error
// (404 if the project doesn't exist, 403 if the caller isn't a member). This is
// the single gate every project/issue handler runs first.
func (h *Handler) loadProjectForMember(c *fiber.Ctx, projID uuid.UUID) (*models.Project, string, error) {
	var p models.Project
	if err := h.DB.First(&p, "id = ?", projID).Error; err != nil {
		return nil, "", fiber.NewError(fiber.StatusNotFound, "project not found")
	}
	pm, err := h.projectMember(projID, middleware.UserID(c))
	if err != nil {
		return nil, "", fiber.NewError(fiber.StatusForbidden, "you are not a member of this project")
	}
	return &p, pm.Role, nil
}

// uuidStr safely stringifies a nullable UUID (empty string for nil).
func uuidStr(p *uuid.UUID) string {
	if p == nil {
		return ""
	}
	return p.String()
}
