package handlers

import (
	"crypto/md5"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"time"

	"github.com/ayushsarode/DriftBox/models"
	"github.com/ayushsarode/DriftBox/utils"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	MaxFileSize    = 50 * 1024 * 1024       // 50MB in bytes
	MaxStorageSize = 2 * 1024 * 1024 * 1024 // 2GB in bytes
)

// UploadFile handles file upload to Google Cloud Storage
func UploadFile(c *gin.Context) {
	// Get user ID from middleware
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDString := userIDInterface.(string)
	userID, err := primitive.ObjectIDFromHex(userIDString)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check user's current storage usage
	storage, err := getUserStorage(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not check storage usage"})
		return
	}

	// Parse multipart form
	err = c.Request.ParseMultipartForm(MaxFileSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large or invalid form data"})
		return
	}

	// Get file from form
	file, fileHeader, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Check file size
	if fileHeader.Size > MaxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds 50MB limit"})
		return
	}

	// Check if upload would exceed storage limit
	if storage.UsedSpace+fileHeader.Size > MaxStorageSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         "Upload would exceed 2GB storage limit",
			"current_usage": storage.UsedSpace,
			"max_storage":   MaxStorageSize,
		})
		return
	}

	// Get folder ID if provided
	folderIDStr := c.PostForm("folder_id")
	var folderID *primitive.ObjectID
	if folderIDStr != "" {
		folderObjID, err := primitive.ObjectIDFromHex(folderIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
			return
		}

		// Verify folder exists and belongs to user
		folderCollection := utils.GetCollection("folders")
		var folder models.Folder
		err = folderCollection.FindOne(c, bson.M{
			"_id":     folderObjID,
			"user_id": userID,
		}).Decode(&folder)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
			return
		}
		folderID = &folderObjID
	}

	// Generate unique filename for GCS
	fileID := primitive.NewObjectID()
	ext := filepath.Ext(fileHeader.Filename)
	gcsFileName := fmt.Sprintf("users/%s/files/%s%s", userIDString, fileID.Hex(), ext)

	// Calculate file hash for deduplication
	file.Seek(0, 0) // Reset file pointer
	hash := md5.New()
	_, err = io.Copy(hash, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not calculate file hash"})
		return
	}
	fileHash := fmt.Sprintf("%x", hash.Sum(nil))

	// Check if file already exists (deduplication)
	fileCollection := utils.GetCollection("files")
	var existingFile models.File
	err = fileCollection.FindOne(c, bson.M{
		"hash":    fileHash,
		"user_id": userID,
	}).Decode(&existingFile)

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":         "File already exists",
			"existing_file": existingFile,
		})
		return
	}

	// Upload file to Google Cloud Storage
	file.Seek(0, 0) // Reset file pointer
	gcsURL, err := utils.UploadToGCS(c, gcsFileName, file, fileHeader.Header.Get("Content-Type"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Could not upload file to storage: %v", err)})
		return
	}

	// Create file record in database
	fileRecord := models.File{
		ID:           fileID,
		Name:         fileHeader.Filename,
		OriginalName: fileHeader.Filename,
		Size:         fileHeader.Size,
		ContentType:  fileHeader.Header.Get("Content-Type"),
		UserID:       userID,
		FolderID:     folderID,
		Path:         gcsFileName, // Store GCS path instead of local path
		URL:          gcsURL,
		Hash:         fileHash,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	_, err = fileCollection.InsertOne(c, fileRecord)
	if err != nil {
		// Clean up GCS file if database insert fails
		utils.DeleteFromGCS(c, gcsFileName)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not save file record"})
		return
	}

	// Update user storage stats
	updateUserStorage(c, userID, fileHeader.Size, 0, 1)

	c.JSON(http.StatusCreated, gin.H{
		"message": "File uploaded successfully",
		"file":    fileRecord,
	})
}

// GetFiles retrieves files for the authenticated user
func GetFiles(c *gin.Context) {
	userIDInterface, _ := c.Get("userID")
	userIDString := userIDInterface.(string)
	userID, _ := primitive.ObjectIDFromHex(userIDString)

	folderID := c.Query("folder_id")
	filter := bson.M{"user_id": userID}

	if folderID != "" {
		folderObjID, err := primitive.ObjectIDFromHex(folderID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
			return
		}
		filter["folder_id"] = folderObjID
	} else {
		filter["folder_id"] = bson.M{"$exists": false}
	}

	collection := utils.GetCollection("files")
	cursor, err := collection.Find(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve files"})
		return
	}
	defer cursor.Close(c)

	var files []models.File
	if err = cursor.All(c, &files); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not decode files"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"files": files})
}

// DownloadFile handles file download using GCS signed URLs
func DownloadFile(c *gin.Context) {
	fileID := c.Param("id")
	fileObjID, err := primitive.ObjectIDFromHex(fileID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	userIDInterface, _ := c.Get("userID")
	userIDString := userIDInterface.(string)
	userID, _ := primitive.ObjectIDFromHex(userIDString)

	// Find file record
	collection := utils.GetCollection("files")
	var file models.File
	err = collection.FindOne(c, bson.M{
		"_id":     fileObjID,
		"user_id": userID,
	}).Decode(&file)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Generate signed URL for download (valid for 1 hour)
	signedURL, err := utils.GenerateSignedURL(c, file.Path, time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate download URL"})
		return
	}

	// Redirect to signed URL or return the URL
	if c.Query("redirect") == "true" {
		c.Redirect(http.StatusFound, signedURL)
	} else {
		c.JSON(http.StatusOK, gin.H{
			"download_url": signedURL,
			"expires_in":   "1 hour",
		})
	}
}

// DeleteFile deletes a file from GCS and database
func DeleteFile(c *gin.Context) {
	fileID := c.Param("id")
	fileObjID, err := primitive.ObjectIDFromHex(fileID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	userIDInterface, _ := c.Get("userID")
	userIDString := userIDInterface.(string)
	userID, _ := primitive.ObjectIDFromHex(userIDString)

	// Find file record
	collection := utils.GetCollection("files")
	var file models.File
	err = collection.FindOne(c, bson.M{
		"_id":     fileObjID,
		"user_id": userID,
	}).Decode(&file)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Delete file from database first
	_, err = collection.DeleteOne(c, bson.M{
		"_id":     fileObjID,
		"user_id": userID,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete file record"})
		return
	}

	// Delete file from Google Cloud Storage
	err = utils.DeleteFromGCS(c, file.Path)
	if err != nil {
		// Log error but don't fail the request since DB record is already deleted
		fmt.Printf("Warning: Could not delete file from GCS: %v\n", err)
	}

	// Update user storage stats
	updateUserStorage(c, userID, -file.Size, 0, -1)

	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

// GetStorageInfo returns user's storage usage information
func GetStorageInfo(c *gin.Context) {
	userIDInterface, _ := c.Get("userID")
	userIDString := userIDInterface.(string)
	userID, _ := primitive.ObjectIDFromHex(userIDString)

	storage, err := getUserStorage(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve storage info"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"storage":          storage,
		"usage_percentage": float64(storage.UsedSpace) / float64(storage.MaxSpace) * 100,
	})
}

// Helper function to get user storage information
func getUserStorage(c *gin.Context, userID primitive.ObjectID) (*models.UserStorage, error) {
	collection := utils.GetCollection("user_storage")
	var storage models.UserStorage

	err := collection.FindOne(c, bson.M{"user_id": userID}).Decode(&storage)
	if err != nil {
		// Create default storage record if it doesn't exist
		storage = models.UserStorage{
			UserID:      userID,
			UsedSpace:   0,
			MaxSpace:    MaxStorageSize,
			FileCount:   0,
			FolderCount: 0,
			UpdatedAt:   time.Now(),
		}
		collection.InsertOne(c, storage)
	}

	return &storage, nil
}
