package handlers

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/auth"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	AccessToken  string       `json:"accessToken"`
	RefreshToken string       `json:"refreshToken"`
	User         *models.User `json:"user"`
}

// Register creates a new user, gives them a personal workspace, and returns
// freshly minted access + refresh tokens (so the client is logged in instantly).
func (h *Handler) Register(c *fiber.Ctx) error {
	var req registerRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email and password are required")
	}
	if len(req.Password) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "password must be at least 8 characters")
	}
	if req.Name == "" {
		req.Name = req.Email
	}

	var existing int64
	h.DB.Model(&models.User{}).Where("email = ?", req.Email).Count(&existing)
	if existing > 0 {
		return fiber.NewError(fiber.StatusConflict, "email already registered")
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not secure password")
	}

	user := models.User{Email: req.Email, PasswordHash: hash, Name: req.Name}

	// Create the user, a personal workspace, and the owning membership
	// atomically — if any step fails, none of them persist.
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		ws := models.Workspace{
			Name:    fmt.Sprintf("%s's Workspace", req.Name),
			Slug:    uniqueSlug(tx, req.Name),
			OwnerID: user.ID,
		}
		if err := tx.Create(&ws).Error; err != nil {
			return err
		}
		member := models.WorkspaceMember{WorkspaceID: ws.ID, UserID: user.ID, Role: "admin"}
		return tx.Create(&member).Error
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not create account")
	}

	return h.issueTokens(c, &user, fiber.StatusCreated)
}

// Login verifies credentials and returns new tokens.
func (h *Handler) Login(c *fiber.Ctx) error {
	var req loginRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	err := h.DB.Where("email = ?", req.Email).First(&user).Error
	// Return the SAME error whether the email is unknown or the password is
	// wrong, so attackers can't enumerate which emails are registered.
	if err != nil || !auth.CheckPassword(req.Password, user.PasswordHash) {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid email or password")
	}

	return h.issueTokens(c, &user, fiber.StatusOK)
}

// Refresh exchanges a valid refresh token (from cookie or body) for a new pair
// of tokens — this is how a session stays alive past the 15-minute access TTL.
func (h *Handler) Refresh(c *fiber.Ctx) error {
	refresh := c.Cookies("refresh_token")
	if refresh == "" {
		// fall back to a JSON body { "refreshToken": "..." }
		var body struct {
			RefreshToken string `json:"refreshToken"`
		}
		_ = c.BodyParser(&body)
		refresh = body.RefreshToken
	}
	if refresh == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "no refresh token provided")
	}

	claims, err := auth.ParseToken(h.Cfg.JWTSecret, refresh)
	if err != nil || claims.Type != auth.RefreshToken {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid refresh token")
	}

	var user models.User
	if err := h.DB.First(&user, "id = ?", claims.UserID).Error; err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "user no longer exists")
	}

	return h.issueTokens(c, &user, fiber.StatusOK)
}

// Logout clears the refresh-token cookie.
func (h *Handler) Logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HTTPOnly: true,
		MaxAge:   -1,
		Path:     "/",
	})
	return c.JSON(fiber.Map{"message": "logged out"})
}

// Me returns the currently authenticated user (protected by RequireAuth).
func (h *Handler) Me(c *fiber.Ctx) error {
	var user models.User
	if err := h.DB.First(&user, "id = ?", middleware.UserID(c)).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}
	return c.JSON(user)
}

// issueTokens mints an access+refresh pair, sets the refresh token as an
// httpOnly cookie (so JavaScript can't read it — mitigates XSS token theft),
// and returns both in the JSON body.
func (h *Handler) issueTokens(c *fiber.Ctx, user *models.User, status int) error {
	access, err := auth.GenerateToken(h.Cfg.JWTSecret, user.ID, user.Email, auth.AccessToken, auth.AccessTokenTTL)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not issue access token")
	}
	refresh, err := auth.GenerateToken(h.Cfg.JWTSecret, user.ID, user.Email, auth.RefreshToken, auth.RefreshTokenTTL)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not issue refresh token")
	}

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refresh,
		HTTPOnly: true,
		Secure:   h.Cfg.Env == "production",
		SameSite: "Lax",
		MaxAge:   int(auth.RefreshTokenTTL.Seconds()),
		Path:     "/",
	})

	return c.Status(status).JSON(authResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         user,
	})
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// uniqueSlug builds a URL-safe workspace slug from a name and appends a short
// random suffix to avoid collisions across workspaces.
func uniqueSlug(_ *gorm.DB, name string) string {
	base := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if base == "" {
		base = "workspace"
	}
	return fmt.Sprintf("%s-%s", base, uuid.New().String()[:8])
}
