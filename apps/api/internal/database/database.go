// Package database manages the PostgreSQL connection and schema migrations.
package database

import (
	"context"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/NithinPasula/clever-sloth/apps/api/internal/models"
)

// Connect opens a GORM connection to Postgres and tunes the underlying pool.
func Connect(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		// Warn level keeps noise down; slow queries still surface.
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, err
	}

	// Connection pool tuning. These limits matter under load and when many API
	// pods each hold a pool — you don't want to exhaust Postgres connections.
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

// ConnectWithRetry tries to connect up to `attempts` times, sleeping between
// tries. Useful at startup when Postgres may still be booting (compose / k8s).
func ConnectWithRetry(dsn string, attempts int, wait time.Duration) (*gorm.DB, error) {
	var lastErr error
	for i := 0; i < attempts; i++ {
		db, err := Connect(dsn)
		if err == nil {
			if pingErr := Ping(context.Background(), db); pingErr == nil {
				return db, nil
			} else {
				lastErr = pingErr
			}
		} else {
			lastErr = err
		}
		time.Sleep(wait)
	}
	return nil, lastErr
}

// Migrate creates or updates tables to match the model structs.
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(models.All()...)
}

// Ping verifies the database is reachable. Used by the readiness probe.
func Ping(ctx context.Context, db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return sqlDB.PingContext(ctx)
}
