package handlers

import (
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

// projectKeyRe enforces Jira-style keys: 2–10 chars, uppercase letters/digits,
// starting with a letter (e.g. "CS", "WEB2").
var projectKeyRe = regexp.MustCompile(`^[A-Z][A-Z0-9]{1,9}$`)

type createProjectRequest struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type updateProjectRequest struct {
	Name        *string    `json:"name"`
	Description *string    `json:"description"`
	LeadID      *uuid.UUID `json:"leadId"`
	Archived    *bool      `json:"archived"`
}

type addMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

// CreateProject creates a project in a workspace and makes the caller its owner.
func (h *Handler) CreateProject(c *fiber.Ctx) error {
	wsID, err := uuid.Parse(c.Params("workspaceId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid workspace id")
	}
	userID := middleware.UserID(c)
	if _, err := h.workspaceMember(wsID, userID); err != nil {
		return fiber.NewError(fiber.StatusForbidden, "you are not a member of this workspace")
	}

	var req createProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Key = strings.ToUpper(strings.TrimSpace(req.Key))
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	if !projectKeyRe.MatchString(req.Key) {
		return fiber.NewError(fiber.StatusBadRequest, "key must be 2-10 uppercase letters/digits, starting with a letter")
	}

	var dup int64
	h.DB.Model(&models.Project{}).Where("workspace_id = ? AND key = ?", wsID, req.Key).Count(&dup)
	if dup > 0 {
		return fiber.NewError(fiber.StatusConflict, "a project with that key already exists in this workspace")
	}

	project := models.Project{
		WorkspaceID: wsID,
		Key:         req.Key,
		Name:        req.Name,
		Description: req.Description,
		LeadID:      &userID,
	}
	// Create the project and the owner membership atomically.
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&project).Error; err != nil {
			return err
		}
		owner := models.ProjectMember{ProjectID: project.ID, UserID: userID, Role: "owner"}
		return tx.Create(&owner).Error
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not create project")
	}
	return c.Status(fiber.StatusCreated).JSON(project)
}

// ListProjects returns the projects in a workspace that the caller is a member of.
func (h *Handler) ListProjects(c *fiber.Ctx) error {
	wsID, err := uuid.Parse(c.Params("workspaceId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid workspace id")
	}
	userID := middleware.UserID(c)
	if _, err := h.workspaceMember(wsID, userID); err != nil {
		return fiber.NewError(fiber.StatusForbidden, "you are not a member of this workspace")
	}

	memberProjects := h.DB.Model(&models.ProjectMember{}).
		Select("project_id").
		Where("user_id = ?", userID)

	var projects []models.Project
	h.DB.Where("workspace_id = ? AND id IN (?)", wsID, memberProjects).
		Order("created_at desc").
		Find(&projects)
	return c.JSON(projects)
}

// GetProject returns a single project the caller can access.
func (h *Handler) GetProject(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	project, _, ferr := h.loadProjectForMember(c, projID)
	if ferr != nil {
		return ferr
	}
	return c.JSON(project)
}

// UpdateProject edits a project. Requires admin or owner role.
func (h *Handler) UpdateProject(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	project, role, ferr := h.loadProjectForMember(c, projID)
	if ferr != nil {
		return ferr
	}
	if !roleAtLeast(role, "admin") {
		return fiber.NewError(fiber.StatusForbidden, "admin or owner role required")
	}

	var req updateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.LeadID != nil {
		updates["lead_id"] = *req.LeadID
	}
	if req.Archived != nil {
		updates["archived"] = *req.Archived
	}
	if len(updates) > 0 {
		if err := h.DB.Model(project).Updates(updates).Error; err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "could not update project")
		}
	}
	return c.JSON(project)
}

// ListProjectMembers lists a project's members.
func (h *Handler) ListProjectMembers(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	if _, _, ferr := h.loadProjectForMember(c, projID); ferr != nil {
		return ferr
	}
	var members []models.ProjectMember
	h.DB.Where("project_id = ?", projID).Find(&members)
	return c.JSON(members)
}

// AddProjectMember adds (or re-roles) a user on a project by email. Admin+ only.
func (h *Handler) AddProjectMember(c *fiber.Ctx) error {
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	_, role, ferr := h.loadProjectForMember(c, projID)
	if ferr != nil {
		return ferr
	}
	if !roleAtLeast(role, "admin") {
		return fiber.NewError(fiber.StatusForbidden, "admin or owner role required")
	}

	var req addMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	if req.Role == "" {
		req.Role = "member"
	}
	if _, ok := projectRoleRank[req.Role]; !ok {
		return fiber.NewError(fiber.StatusBadRequest, "role must be one of viewer, member, admin, owner")
	}

	var user models.User
	if err := h.DB.Where("email = ?", strings.ToLower(strings.TrimSpace(req.Email))).First(&user).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "no user with that email")
	}

	// Upsert: update the role if already a member, otherwise create.
	var existing models.ProjectMember
	if err := h.DB.Where("project_id = ? AND user_id = ?", projID, user.ID).First(&existing).Error; err == nil {
		h.DB.Model(&existing).Update("role", req.Role)
		return c.JSON(existing)
	}
	member := models.ProjectMember{ProjectID: projID, UserID: user.ID, Role: req.Role}
	if err := h.DB.Create(&member).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not add member")
	}
	return c.Status(fiber.StatusCreated).JSON(member)
}
