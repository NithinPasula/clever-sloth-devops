// Package server wires together the Fiber HTTP application: middleware,
// the Kubernetes health endpoints, the Prometheus scrape endpoint, and routes.
package server

import (
	"bytes"
	"encoding/json"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"gorm.io/gorm"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/config"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/database"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/handlers"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/middleware"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/observability"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/storage"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/ws"
)

// New builds and returns a configured Fiber app, ready to Listen.
// db may be nil if the database was unreachable at startup; in that case the
// process still runs (liveness OK) but readiness reports "not ready".
func New(cfg *config.Config, db *gorm.DB, store *storage.Storage, hub *ws.Hub) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:               "clever-sloth-api",
		DisableStartupMessage: true,
		// Default Go JSON escapes &, <, > as & etc. That's valid JSON but
		// mangles values like presigned URLs for non-browser clients. Disable
		// HTML escaping so URLs come out with literal & and are usable anywhere.
		JSONEncoder: jsonEncoder,
		// Return all errors as JSON {"error": "..."} instead of Fiber's default
		// plain text, so the frontend always parses a consistent shape.
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// recover: turn panics into 500s instead of crashing the whole pod.
	app.Use(recover.New())
	// cors: allow the Next.js frontend (different origin) to call this API.
	app.Use(cors.New())
	// metrics: must run on every request so Prometheus sees all traffic.
	app.Use(metricsMiddleware())

	// ---- Kubernetes probe endpoints ----
	// Liveness: "is the process alive?" If this fails, the kubelet RESTARTS the pod.
	// Keep it dependency-free — it must succeed even if the DB is down, otherwise
	// a DB blip would trigger pointless restart loops.
	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Readiness: "can this pod serve traffic right now?" If this fails, Kubernetes
	// removes the pod from the Service load balancer but does NOT restart it.
	// We actively ping Postgres so a pod whose DB is unreachable stops receiving
	// traffic until the connection recovers.
	app.Get("/readyz", func(c *fiber.Ctx) error {
		if db == nil {
			return c.Status(fiber.StatusServiceUnavailable).
				JSON(fiber.Map{"status": "not ready", "reason": "database not connected"})
		}
		if err := database.Ping(c.Context(), db); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).
				JSON(fiber.Map{"status": "not ready", "reason": "database ping failed"})
		}
		return c.JSON(fiber.Map{"status": "ready"})
	})

	// Prometheus scrape target. adaptor.HTTPHandler bridges the standard
	// net/http promhttp handler into Fiber's handler type.
	app.Get("/metrics", adaptor.HTTPHandler(promhttp.Handler()))

	// ---- Application API ----
	h := handlers.New(db, cfg, store, hub)

	api := app.Group("/api/v1")
	api.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "pong", "env": cfg.Env})
	})

	// protected gates a route behind a valid access token.
	protected := middleware.RequireAuth(cfg.JWTSecret)

	// Auth routes (public, except /me).
	authGroup := api.Group("/auth")
	authGroup.Post("/register", h.Register)
	authGroup.Post("/login", h.Login)
	authGroup.Post("/refresh", h.Refresh)
	authGroup.Post("/logout", h.Logout)
	authGroup.Get("/me", protected, h.Me)

	// Workspaces.
	api.Get("/workspaces", protected, h.ListWorkspaces)
	api.Post("/workspaces/:workspaceId/projects", protected, h.CreateProject)
	api.Get("/workspaces/:workspaceId/projects", protected, h.ListProjects)

	// Projects.
	api.Get("/projects/:projectId", protected, h.GetProject)
	api.Patch("/projects/:projectId", protected, h.UpdateProject)
	api.Get("/projects/:projectId/members", protected, h.ListProjectMembers)
	api.Post("/projects/:projectId/members", protected, h.AddProjectMember)

	// Issues.
	api.Post("/projects/:projectId/issues", protected, h.CreateIssue)
	api.Get("/projects/:projectId/issues", protected, h.ListIssues)
	api.Get("/projects/:projectId/board", protected, h.GetBoard)
	api.Get("/issues/:issueId", protected, h.GetIssue)
	api.Patch("/issues/:issueId", protected, h.UpdateIssue)
	api.Delete("/issues/:issueId", protected, h.DeleteIssue)
	api.Get("/issues/:issueId/activity", protected, h.ListActivity)

	// Comments.
	api.Post("/issues/:issueId/comments", protected, h.CreateComment)
	api.Get("/issues/:issueId/comments", protected, h.ListComments)

	// Sprints.
	api.Post("/projects/:projectId/sprints", protected, h.CreateSprint)
	api.Get("/projects/:projectId/sprints", protected, h.ListSprints)
	api.Patch("/sprints/:sprintId", protected, h.UpdateSprint)
	api.Post("/sprints/:sprintId/start", protected, h.StartSprint)
	api.Post("/sprints/:sprintId/complete", protected, h.CompleteSprint)

	// Attachments (MinIO presigned URLs).
	api.Post("/issues/:issueId/attachments", protected, h.CreateAttachment)
	api.Get("/issues/:issueId/attachments", protected, h.ListAttachments)
	api.Get("/attachments/:attachmentId/download", protected, h.DownloadAttachment)
	api.Delete("/attachments/:attachmentId", protected, h.DeleteAttachment)

	// WebSocket: live board updates. Auth via ?token= (see WSUpgradeGuard).
	api.Get("/projects/:projectId/board/ws", h.WSUpgradeGuard, h.BoardSocket())

	return app
}

// jsonEncoder marshals JSON without HTML-escaping &, <, > (see JSONEncoder above).
func jsonEncoder(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil // Encode appends a newline
}

// metricsMiddleware records request count and latency for every request.
// We use c.Route().Path (the route TEMPLATE, e.g. "/api/v1/issues/:id") rather
// than the raw URL, to keep Prometheus label cardinality bounded.
func metricsMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Run the rest of the chain first so the route is matched and the
		// final status code is known.
		err := c.Next()

		duration := time.Since(start).Seconds()
		route := c.Route().Path
		method := c.Method()
		status := strconv.Itoa(c.Response().StatusCode())

		observability.HTTPRequestsTotal.WithLabelValues(method, route, status).Inc()
		observability.HTTPRequestDuration.WithLabelValues(method, route).Observe(duration)

		return err
	}
}
