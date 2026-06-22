// Package ws implements a simple in-memory WebSocket broadcast hub.
//
// Clients connect to a "room" (one per project board). When an issue changes,
// handlers call Broadcast to push the event to everyone watching that board —
// this is what makes the Kanban board update live without polling.
//
// NOTE: this hub is in-memory, so it only fans out to clients connected to THE
// SAME API pod. Once we run multiple API replicas (Phase 6 HPA), we'll put Redis
// pub/sub in front of Broadcast so every pod receives every event. The Hub
// interface is intentionally small so that swap is localized.
package ws

import (
	"encoding/json"
	"sync"
)

// Client is one connected WebSocket subscriber. The handler owns the socket and
// drains Send to the wire.
type Client struct {
	ProjectID string
	Send      chan []byte
}

// Event is the message shape broadcast to board subscribers.
type Event struct {
	Type    string `json:"type"` // "issue.created" | "issue.updated" | "issue.deleted"
	Payload any    `json:"payload"`
}

// Hub tracks clients grouped by project room.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]bool
}

// NewHub creates an empty hub.
func NewHub() *Hub {
	return &Hub{rooms: make(map[string]map[*Client]bool)}
}

// Register adds a client to its project room.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[c.ProjectID] == nil {
		h.rooms[c.ProjectID] = make(map[*Client]bool)
	}
	h.rooms[c.ProjectID][c] = true
}

// Unregister removes a client and closes its send channel.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.rooms[c.ProjectID]; ok {
		if _, ok := clients[c]; ok {
			delete(clients, c)
			close(c.Send)
			if len(clients) == 0 {
				delete(h.rooms, c.ProjectID)
			}
		}
	}
}

// Broadcast sends an event to every client in a project room. Slow clients
// (full buffer) are skipped rather than blocking the whole broadcast.
func (h *Hub) Broadcast(projectID string, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[projectID] {
		select {
		case c.Send <- data:
		default:
		}
	}
}
