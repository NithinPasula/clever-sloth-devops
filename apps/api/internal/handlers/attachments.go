package handlers

import (
	"log/slog"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

const presignTTL = 15 * time.Minute

type createAttachmentRequest struct {
	FileName    string `json:"fileName"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

// CreateAttachment registers an attachment and returns a presigned PUT URL the
// client uploads the file bytes to directly (the API never sees the bytes).
func (h *Handler) CreateAttachment(c *fiber.Ctx) error {
	if h.Storage == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "file storage is unavailable")
	}
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}
	var req createAttachmentRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.FileName = strings.TrimSpace(req.FileName)
	if req.FileName == "" {
		return fiber.NewError(fiber.StatusBadRequest, "fileName is required")
	}

	// Object key is opaque (issueID/uuid) — we keep the human name in the DB.
	objectKey := issue.ID.String() + "/" + uuid.New().String()

	att := models.Attachment{
		IssueID:     issue.ID,
		UploaderID:  middleware.UserID(c),
		FileName:    req.FileName,
		ObjectKey:   objectKey,
		Size:        req.Size,
		ContentType: req.ContentType,
	}
	if err := h.DB.Create(&att).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not create attachment")
	}

	uploadURL, err := h.Storage.PresignedPutURL(c.Context(), objectKey, presignTTL)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not create upload url")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"attachment": att,
		"uploadUrl":  uploadURL,
		"expiresIn":  int(presignTTL.Seconds()),
	})
}

// ListAttachments lists an issue's attachments.
func (h *Handler) ListAttachments(c *fiber.Ctx) error {
	issue, ferr := h.loadIssueForMember(c)
	if ferr != nil {
		return ferr
	}
	var atts []models.Attachment
	h.DB.Where("issue_id = ?", issue.ID).Order("created_at asc").Find(&atts)
	return c.JSON(atts)
}

// DownloadAttachment returns a short-lived presigned GET URL for the file.
func (h *Handler) DownloadAttachment(c *fiber.Ctx) error {
	if h.Storage == nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "file storage is unavailable")
	}
	att, ferr := h.loadAttachmentForMember(c)
	if ferr != nil {
		return ferr
	}
	url, err := h.Storage.PresignedGetURL(c.Context(), att.ObjectKey, att.FileName, presignTTL)
	if err != nil {
		slog.Error("presigned get url failed", "error", err, "objectKey", att.ObjectKey, "fileName", att.FileName)
		return fiber.NewError(fiber.StatusInternalServerError, "could not create download url")
	}
	return c.JSON(fiber.Map{"url": url, "expiresIn": int(presignTTL.Seconds())})
}

// DeleteAttachment removes the object from MinIO and the DB row. Allowed for
// project admins/owners or the original uploader.
func (h *Handler) DeleteAttachment(c *fiber.Ctx) error {
	att, ferr := h.loadAttachmentForMember(c)
	if ferr != nil {
		return ferr
	}
	var issue models.Issue
	if err := h.DB.First(&issue, "id = ?", att.IssueID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "issue not found")
	}
	_, role, _ := h.loadProjectForMember(c, issue.ProjectID)
	if !roleAtLeast(role, "admin") && att.UploaderID != middleware.UserID(c) {
		return fiber.NewError(fiber.StatusForbidden, "only an admin or the uploader can delete this attachment")
	}
	if h.Storage != nil {
		_ = h.Storage.Remove(c.Context(), att.ObjectKey) // best-effort object cleanup
	}
	if err := h.DB.Delete(att).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not delete attachment")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// loadAttachmentForMember loads the :attachmentId and verifies the caller is a
// member of the owning project.
func (h *Handler) loadAttachmentForMember(c *fiber.Ctx) (*models.Attachment, error) {
	attID, err := uuid.Parse(c.Params("attachmentId"))
	if err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "invalid attachment id")
	}
	var att models.Attachment
	if err := h.DB.First(&att, "id = ?", attID).Error; err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "attachment not found")
	}
	var issue models.Issue
	if err := h.DB.First(&issue, "id = ?", att.IssueID).Error; err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "issue not found")
	}
	if _, _, ferr := h.loadProjectForMember(c, issue.ProjectID); ferr != nil {
		return nil, ferr
	}
	return &att, nil
}
