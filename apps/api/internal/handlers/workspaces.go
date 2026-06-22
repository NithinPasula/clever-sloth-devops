package handlers

import (
	"github.com/gofiber/fiber/v2"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

// ListWorkspaces returns every workspace the caller belongs to.
func (h *Handler) ListWorkspaces(c *fiber.Ctx) error {
	userID := middleware.UserID(c)
	var workspaces []models.Workspace
	// Subquery: workspace ids where the caller has a membership row.
	memberWS := h.DB.Model(&models.WorkspaceMember{}).
		Select("workspace_id").
		Where("user_id = ?", userID)
	h.DB.Where("id IN (?)", memberWS).Order("created_at asc").Find(&workspaces)
	return c.JSON(workspaces)
}
