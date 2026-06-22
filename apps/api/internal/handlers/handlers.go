// Package handlers implements the HTTP request handlers for the API.
//
// Handlers hang off a single Handler struct that carries shared dependencies
// (the DB handle and config). This keeps wiring explicit and makes handlers
// trivially testable — you construct a Handler with a test DB and call methods.
package handlers

import (
	"gorm.io/gorm"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/config"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/storage"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/ws"
)

// Handler holds dependencies shared by all route handlers.
type Handler struct {
	DB      *gorm.DB
	Cfg     *config.Config
	Storage *storage.Storage // may be nil if MinIO was unreachable at startup
	Hub     *ws.Hub          // WebSocket broadcast hub for live board updates
}

// New constructs a Handler.
func New(db *gorm.DB, cfg *config.Config, store *storage.Storage, hub *ws.Hub) *Handler {
	return &Handler{DB: db, Cfg: cfg, Storage: store, Hub: hub}
}
