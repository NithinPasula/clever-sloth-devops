// Package storage wraps the MinIO (S3-compatible) client used for attachments.
//
// We use PRESIGNED URLs rather than streaming file bytes through the API. The
// client uploads/downloads directly to MinIO using a short-lived signed URL, so
// large files never consume API pod memory or bandwidth — this is how you keep
// a stateless API horizontally scalable (important for HPA in Phase 6).
//
// Two clients, one bucket:
//   - ops:     performs real operations (bucket checks, deletes) over the
//              IN-CLUSTER network (e.g. minio:9000, plain HTTP). Private, simple,
//              no TLS / no private-CA trust needed inside the pod.
//   - presign: ONLY signs presigned URLs — a local, offline operation that never
//              connects. It points at the PUBLIC host/scheme the browser uses, so
//              the AWS-v4 signature matches the request the browser actually makes.
//
// Splitting them lets the browser talk to MinIO over public HTTPS (no mixed
// content) while the API talks to it privately over HTTP — without the API
// having to trust the private CA or pin the ingress IP via hostAliases.
package storage

import (
	"context"
	"log/slog"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// minioRegion is set explicitly on the clients so minio-go signs presigned URLs
// WITHOUT a getBucketLocation ("?location=") network call. That call is fatal for
// the presign client, whose public host isn't reachable from inside the pod. It
// must match MinIO's region (default "us-east-1"), or signatures won't validate.
const minioRegion = "us-east-1"

// Storage is a thin wrapper around the MinIO clients bound to one bucket.
type Storage struct {
	ops     *minio.Client // in-cluster operations (real network calls)
	presign *minio.Client // presigned-URL signing only (offline)
	bucket  string
}

// New builds both clients. It does NOT verify connectivity, so a MinIO that is
// not reachable yet at startup cannot fail process start — call
// EnsureBucketWithRetry afterwards to create the bucket once MinIO is up.
//
// publicEndpoint/publicUseSSL describe the host the BROWSER uses for presigned
// URLs. When publicEndpoint is empty (e.g. local docker-compose dev where the
// API and browser share one host) it falls back to the ops endpoint.
func New(endpoint, accessKey, secretKey, bucket string, useSSL bool, publicEndpoint string, publicUseSSL bool) (*Storage, error) {
	creds := credentials.NewStaticV4(accessKey, secretKey, "")

	ops, err := minio.New(endpoint, &minio.Options{Creds: creds, Secure: useSSL, Region: minioRegion})
	if err != nil {
		return nil, err
	}

	if publicEndpoint == "" {
		publicEndpoint = endpoint
		publicUseSSL = useSSL
	}
	presign, err := minio.New(publicEndpoint, &minio.Options{Creds: creds, Secure: publicUseSSL, Region: minioRegion})
	if err != nil {
		return nil, err
	}

	return &Storage{ops: ops, presign: presign, bucket: bucket}, nil
}

// EnsureBucket creates the bucket if it doesn't already exist.
func (s *Storage) EnsureBucket(ctx context.Context) error {
	exists, err := s.ops.BucketExists(ctx, s.bucket)
	if err != nil {
		return err
	}
	if !exists {
		return s.ops.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{})
	}
	return nil
}

// EnsureBucketWithRetry keeps trying to verify/create the bucket using
// exponential backoff (capped at maxBackoff) until it succeeds. Run it in a
// goroutine at startup: a MinIO that isn't reachable yet (pod start-order races)
// then self-heals once it comes up, instead of permanently disabling uploads.
func (s *Storage) EnsureBucketWithRetry(initialBackoff, maxBackoff time.Duration) {
	backoff := initialBackoff
	for attempt := 1; ; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err := s.EnsureBucket(ctx)
		cancel()
		if err == nil {
			slog.Info("object storage bucket ready", "bucket", s.bucket, "attempts", attempt)
			return
		}
		slog.Warn("object storage not reachable yet; retrying",
			"bucket", s.bucket, "attempt", attempt, "retry_in", backoff.String(), "error", err)
		time.Sleep(backoff)
		if backoff < maxBackoff {
			if backoff *= 2; backoff > maxBackoff {
				backoff = maxBackoff
			}
		}
	}
}

// PresignedPutURL returns a URL the client can HTTP PUT a file to directly.
func (s *Storage) PresignedPutURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	u, err := s.presign.PresignedPutObject(ctx, s.bucket, objectKey, expiry)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// PresignedGetURL returns a temporary download URL. The content-disposition
// override makes the browser download the file under its original name.
func (s *Storage) PresignedGetURL(ctx context.Context, objectKey, fileName string, expiry time.Duration) (string, error) {
	params := make(url.Values)
	params.Set("response-content-disposition", `attachment; filename="`+fileName+`"`)
	u, err := s.presign.PresignedGetObject(ctx, s.bucket, objectKey, expiry, params)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// Remove deletes an object from the bucket.
func (s *Storage) Remove(ctx context.Context, objectKey string) error {
	return s.ops.RemoveObject(ctx, s.bucket, objectKey, minio.RemoveObjectOptions{})
}
