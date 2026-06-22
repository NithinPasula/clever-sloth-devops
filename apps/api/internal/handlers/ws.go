package handlers

import (
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/auth"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/ws"
)

// WSUpgradeGuard authenticates and authorizes a WebSocket upgrade request.
//
// Browsers can't set an Authorization header on a WebSocket, so we accept the
// access token as a `?token=` query param and validate it here, plus verify the
// caller is a member of the project, BEFORE allowing the upgrade.
func (h *Handler) WSUpgradeGuard(c *fiber.Ctx) error {
	if !websocket.IsWebSocketUpgrade(c) {
		return fiber.ErrUpgradeRequired
	}
	claims, err := auth.ParseToken(h.Cfg.JWTSecret, c.Query("token"))
	if err != nil || claims.Type != auth.AccessToken {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid token")
	}
	projID, err := uuid.Parse(c.Params("projectId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid project id")
	}
	if _, err := h.projectMember(projID, claims.UserID); err != nil {
		return fiber.NewError(fiber.StatusForbidden, "you are not a member of this project")
	}
	return c.Next()
}

// BoardSocket upgrades the connection and streams board events for the project.
func (h *Handler) BoardSocket() fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		projectID := c.Params("projectId")
		client := &ws.Client{ProjectID: projectID, Send: make(chan []byte, 16)}
		h.Hub.Register(client)
		defer h.Hub.Unregister(client)

		// Writer: drain the client's Send channel to the socket.
		go func() {
			for msg := range client.Send {
				if err := c.WriteMessage(websocket.TextMessage, msg); err != nil {
					return
				}
			}
		}()

		// Reader: we don't expect inbound messages, but we must read to detect
		// disconnects and keep the connection healthy.
		for {
			if _, _, err := c.ReadMessage(); err != nil {
				break
			}
		}
	})
}

// broadcast is a nil-safe helper handlers use to emit board events.
func (h *Handler) broadcast(projectID uuid.UUID, eventType string, payload any) {
	if h.Hub == nil {
		return
	}
	h.Hub.Broadcast(projectID.String(), ws.Event{Type: eventType, Payload: payload})
}
