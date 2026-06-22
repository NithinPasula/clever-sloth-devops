// Package storage wraps the MinIO (S3-compatible) client used for attachments.
//
// We use PRESIGNED URLs rather than streaming file bytes through the API. The
// client uploads/downloads directly to MinIO using a short-lived signed URL, so
// large files never consume API pod memory or bandwidth — this is how you keep
// a stateless API horizontally scalable (important for HPA in Phase 6).
package storage

import (
	"context"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Storage is a thin wrapper around a MinIO client bound to one bucket.
type Storage struct {
	client *minio.Client
	bucket string
}

// New connects to MinIO and ensures the target bucket exists.
func New(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*Storage, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, err
	}
	s := &Storage{client: client, bucket: bucket}
	if err := s.ensureBucket(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

// ensureBucket creates the bucket if it doesn't already exist.
func (s *Storage) ensureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return err
	}
	if !exists {
		return s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{})
	}
	return nil
}

// PresignedPutURL returns a URL the client can HTTP PUT a file to directly.
func (s *Storage) PresignedPutURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	u, err := s.client.PresignedPutObject(ctx, s.bucket, objectKey, expiry)
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
	u, err := s.client.PresignedGetObject(ctx, s.bucket, objectKey, expiry, params)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// Remove deletes an object from the bucket.
func (s *Storage) Remove(ctx context.Context, objectKey string) error {
	return s.client.RemoveObject(ctx, s.bucket, objectKey, minio.RemoveObjectOptions{})
}
