package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

type createCommentRequest struct {
	Body string `json:"body"`
}

// CreateComment adds a comment to an issue.
func (h *Handler) CreateComment(c *fiber.Ctx) error {
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}
	var req createCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		return fiber.NewError(fiber.StatusBadRequest, "comment body is required")
	}
	comment := models.Comment{IssueID: issue.ID, AuthorID: middleware.UserID(c), Body: req.Body}
	if err := h.DB.Create(&comment).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not create comment")
	}
	return c.Status(fiber.StatusCreated).JSON(comment)
}

// ListComments returns an issue's comments oldest-first.
func (h *Handler) ListComments(c *fiber.Ctx) error {
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}
	var comments []models.Comment
	h.DB.Where("issue_id = ?", issue.ID).Order("created_at asc").Find(&comments)
	return c.JSON(comments)
}
