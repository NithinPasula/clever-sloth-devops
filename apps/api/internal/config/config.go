// Package config loads runtime configuration from environment variables.
//
// We follow the 12-factor app methodology: every deployable difference between
// dev / staging / prod is an env var, never a code change or a baked-in file.
// This is what lets the SAME container image run in every Kubernetes namespace.
package config

import "os"

// Config holds all runtime settings for the API.
type Config struct {
	Env         string // "development" | "staging" | "production"
	Port        string // HTTP port to listen on
	DatabaseURL string // PostgreSQL DSN
	RedisURL    string // Redis connection string
	JWTSecret   string // secret used to sign access/refresh tokens
	LogLevel    string // "debug" | "info" | "warn" | "error"

	// MinIO / S3 object storage (issue attachments).
	MinioEndpoint  string // in-cluster endpoint the API talks to (e.g. minio:9000)
	MinioAccessKey string
	MinioSecretKey string
	MinioBucket    string
	MinioUseSSL    bool

	// Public endpoint used ONLY to sign presigned URLs for the browser. May differ
	// from MinioEndpoint (e.g. a public HTTPS ingress host). Empty => same as MinioEndpoint.
	MinioPublicEndpoint string
	MinioPublicUseSSL   bool
}

// Load reads configuration from the environment, falling back to sensible
// development defaults so the app can boot locally with zero setup.
func Load() *Config {
	return &Config{
		Env:         getEnv("APP_ENV", "development"),
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:5433/cleversloth?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-me"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),

		MinioEndpoint:  getEnv("MINIO_ENDPOINT", "127.0.0.1:9000"),
		MinioAccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinioBucket:    getEnv("MINIO_BUCKET", "attachments"),
		MinioUseSSL:    getEnv("MINIO_USE_SSL", "false") == "true",

		MinioPublicEndpoint: getEnv("MINIO_PUBLIC_ENDPOINT", ""),
		MinioPublicUseSSL:   getEnv("MINIO_PUBLIC_USE_SSL", "false") == "true",
	}
}

// getEnv returns the value of key, or fallback if the variable is unset.
func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
