// Package middleware contains Fiber middleware shared across routes.
package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/auth"
)

// Context keys under which we stash the authenticated identity.
const (
	ctxUserID = "userID"
	ctxEmail  = "email"
)

// RequireAuth rejects requests that don't carry a valid access token in the
// `Authorization: Bearer <token>` header. On success it stores the user id and
// email in the request context for downstream handlers.
func RequireAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return fiber.NewError(fiber.StatusUnauthorized, "missing or malformed authorization header")
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		claims, err := auth.ParseToken(secret, tokenStr)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}
		// An attacker must not be able to use a refresh token to access
		// protected endpoints, so enforce the token type here.
		if claims.Type != auth.AccessToken {
			return fiber.NewError(fiber.StatusUnauthorized, "access token required")
		}

		c.Locals(ctxUserID, claims.UserID)
		c.Locals(ctxEmail, claims.Email)
		return c.Next()
	}
}

// UserID returns the authenticated user's id (or uuid.Nil if unauthenticated).
func UserID(c *fiber.Ctx) uuid.UUID {
	if v, ok := c.Locals(ctxUserID).(uuid.UUID); ok {
		return v
	}
	return uuid.Nil
}
