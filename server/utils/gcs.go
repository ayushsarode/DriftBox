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

// InitGCS initializes Google Cloud Storage client
func InitGCS() error {
	ctx := context.Background()

	// Get bucket name from environment
	bucketName = os.Getenv("GCS_BUCKET_NAME")
	if bucketName == "" {
		return fmt.Errorf("GCS_BUCKET_NAME environment variable not set")
	}

	// Get service account key path from environment
	credentialsPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")

	var client *storage.Client
	var err error

	if credentialsPath != "" {
		// Use service account key file
		client, err = storage.NewClient(ctx, option.WithCredentialsFile(credentialsPath))
	} else {
		// Use default credentials (for production with workload identity)
		client, err = storage.NewClient(ctx)
	}

	if err != nil {
		return fmt.Errorf("failed to create GCS client: %v", err)
	}

	storageClient = client
	return nil
}

// UploadToGCS uploads a file to Google Cloud Storage
func UploadToGCS(ctx context.Context, fileName string, fileReader io.Reader, contentType string) (string, error) {
	if storageClient == nil {
		return "", fmt.Errorf("GCS client not initialized")
	}

	bucket := storageClient.Bucket(bucketName)
	object := bucket.Object(fileName)

	// Create a writer to upload the file
	writer := object.NewWriter(ctx)
	writer.ContentType = contentType

	//  metadata
	writer.Metadata = map[string]string{
		"uploaded": time.Now().Format(time.RFC3339),
	}

	// Copy file data to GCS
	if _, err := io.Copy(writer, fileReader); err != nil {
		writer.Close()
		return "", fmt.Errorf("failed to upload file: %v", err)
	}

	// Close the writer to finalize the upload
	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to close writer: %v", err)
	}

	// Generate download URL
	url := fmt.Sprintf("https://storage.googleapis.com/%s/%s", bucketName, fileName)
	return url, nil
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

// GenerateSignedURL generates a signed URL for file download
func GenerateSignedURL(ctx context.Context, fileName string, expiration time.Duration) (string, error) {
	if storageClient == nil {
		return "", fmt.Errorf("GCS client not initialized")
	}

	opts := &storage.SignedURLOptions{
		Scheme:  storage.SigningSchemeV4,
		Method:  "GET",
		Expires: time.Now().Add(expiration),
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
