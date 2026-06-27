// Command server is the entrypoint for the Clever Sloth API.
//
// Responsibilities, in order:
//  1. load .env (local dev convenience) and environment config
//  2. set up structured JSON logging (so Loki can parse logs in Phase 5)
//  3. start the HTTP server in a goroutine
//  4. block until SIGINT/SIGTERM, then shut down gracefully
//
// Graceful shutdown matters in Kubernetes: when a pod is deleted (rolling
// update, scale-down), the kubelet sends SIGTERM and waits up to
// terminationGracePeriodSeconds. Draining in-flight requests here is what makes
// zero-downtime deploys actually zero-downtime.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/config"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/database"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/server"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/storage"
	"github.com/NithinPasula/clever-sloth/apps/api/internal/ws"
)

func main() {
	// Load .env if present. Ignored in production where env vars come from the
	// container runtime / Kubernetes Secrets & ConfigMaps.
	_ = godotenv.Load()

	cfg := config.Load()

	// Structured JSON logs to stdout. In Kubernetes, stdout is collected by the
	// node's container runtime and shipped to Loki by Promtail — no log files,
	// no log rotation to manage. This is the "12-factor logs as event streams".
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLevel(cfg.LogLevel),
	}))
	slog.SetDefault(logger)

	// Connect to Postgres with retry — at startup the DB may still be booting
	// (docker compose / Kubernetes). If it never comes up we start in a
	// degraded state: the process is alive (liveness OK) but readiness is red,
	// so Kubernetes won't route traffic to us until the DB is reachable.
	// Retry for up to ~60s so a Postgres that's still booting (common when the
	// machine is under load and containers start slowly) doesn't leave us
	// permanently degraded.
	db, err := database.ConnectWithRetry(cfg.DatabaseURL, 30, 2*time.Second)
	if err != nil {
		slog.Error("could not connect to database; starting in degraded mode", "error", err)
	} else {
		slog.Info("database connected; running migrations")
		if migErr := database.Migrate(db); migErr != nil {
			slog.Error("migration failed", "error", migErr)
		} else {
			slog.Info("migrations applied")
		}
	}

	// Build the MinIO client(s) for attachments. Client construction is local and
	// does not connect, so it won't fail on a MinIO that's still booting.
	store, err := storage.New(
		cfg.MinioEndpoint, cfg.MinioAccessKey, cfg.MinioSecretKey, cfg.MinioBucket, cfg.MinioUseSSL,
		cfg.MinioPublicEndpoint, cfg.MinioPublicUseSSL,
	)
	if err != nil {
		slog.Error("could not init object storage client; attachments disabled", "error", err)
		store = nil
	} else {
		slog.Info("object storage client ready", "bucket", cfg.MinioBucket)
		// Create the bucket in the background, retrying until MinIO is reachable.
		// This self-heals pod start-order races (API up before MinIO) instead of
		// permanently disabling uploads.
		go store.EnsureBucketWithRetry(2*time.Second, 30*time.Second)
	}

	// WebSocket hub for live board updates.
	hub := ws.NewHub()

	app := server.New(cfg, db, store, hub)

	// Run the listener in a goroutine so main can wait for shutdown signals.
	go func() {
		addr := ":" + cfg.Port
		slog.Info("starting server", "addr", addr, "env", cfg.Env)
		if err := app.Listen(addr); err != nil {
			slog.Error("server stopped unexpectedly", "error", err)
			os.Exit(1)
		}
	}()

	// Block until we receive an interrupt or termination signal.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutdown signal received, draining connections")

	// Give in-flight requests up to 10s to finish before forcing exit.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := app.ShutdownWithContext(ctx); err != nil {
		slog.Error("forced shutdown", "error", err)
	}

	slog.Info("server exited cleanly")
}

// parseLevel maps a log-level string to an slog.Level.
func parseLevel(s string) slog.Level {
	switch s {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
