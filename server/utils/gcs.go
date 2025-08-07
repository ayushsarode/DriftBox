package utils

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"cloud.google.com/go/storage"
	"google.golang.org/api/option"
)

var (
	storageClient *storage.Client
	bucketName    string
)

func InitGCS() error {
	ctx := context.Background()

	bucketName = os.Getenv("GCS_BUCKET_NAME")
	if bucketName == "" {
		return fmt.Errorf("GCS_BUCKET_NAME environment variable not set")
	}

	credentialsPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")

	var client *storage.Client
	var err error

	if credentialsPath != "" {
		client, err = storage.NewClient(ctx, option.WithCredentialsFile(credentialsPath))
	} else {
		client, err = storage.NewClient(ctx)
	}

	if err != nil {
		return fmt.Errorf("failed to create GCS client: %v", err)
	}

	storageClient = client
	return nil
}

func UploadToGCS(ctx context.Context, fileName string, fileReader io.Reader, contentType string) (string, error) {
	if storageClient == nil {
		return "", fmt.Errorf("GCS client not initialized")
	}

	bucket := storageClient.Bucket(bucketName)
	object := bucket.Object(fileName)

	writer := object.NewWriter(ctx)
	writer.ContentType = contentType

	writer.Metadata = map[string]string{
		"uploaded": time.Now().Format(time.RFC3339),
	}

	if _, err := io.Copy(writer, fileReader); err != nil {
		writer.Close()
		return "", fmt.Errorf("failed to upload file: %v", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close writer: %v", err)
	}

	// Return the file path (not a direct URL) - downloads will be handled by our API
	return fileName, nil
}

// DeleteFromGCS deletes a file from Google Cloud Storage
func DeleteFromGCS(ctx context.Context, fileName string) error {
	if storageClient == nil {
		return fmt.Errorf("GCS client not initialized")
	}

	bucket := storageClient.Bucket(bucketName)
	object := bucket.Object(fileName)

	if err := object.Delete(ctx); err != nil {
		return fmt.Errorf("failed to delete file: %v", err)
	}

	return nil
}

// DownloadFromGCS downloads a file from Google Cloud Storage and returns a reader
func DownloadFromGCS(ctx context.Context, fileName string) (io.ReadCloser, error) {
	if storageClient == nil {
		return nil, fmt.Errorf("GCS client not initialized")
	}

	bucket := storageClient.Bucket(bucketName)
	object := bucket.Object(fileName)

	reader, err := object.NewReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create reader: %v", err)
	}

	return reader, nil
}

// GenerateSignedURL generates a signed URL for file download
func GenerateSignedURL(ctx context.Context, fileName string, expiration time.Duration) (string, error) {
	if storageClient == nil {
		return "", fmt.Errorf("GCS client not initialized")
	}

	// Get service account email for signing
	credentialsPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if credentialsPath == "" {
		return "", fmt.Errorf("GOOGLE_APPLICATION_CREDENTIALS not set - required for signed URLs")
	}

	opts := &storage.SignedURLOptions{
		Scheme:  storage.SigningSchemeV4,
		Method:  "GET",
		Expires: time.Now().Add(expiration),
		// Remove problematic headers that cause MalformedSecurityHeader
	}

	url, err := storageClient.Bucket(bucketName).SignedURL(fileName, opts)
	if err != nil {
		return "", fmt.Errorf("failed to generate signed URL: %v", err)
	}

	return url, nil
}

// GetGCSClient returns the GCS client instance
func GetGCSClient() *storage.Client {
	return storageClient
}

// GetBucketName returns the configured bucket name
func GetBucketName() string {
	return bucketName
}
