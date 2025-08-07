package handlers

import (
	"crypto/md5"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"github.com/ayushsarode/DriftBox/models"
	"github.com/ayushsarode/DriftBox/utils"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	MaxFileSize    = 50 * 1024 * 1024       // 50MB in bytes
	MaxStorageSize = 2 * 1024 * 1024 * 1024 // 2GB in bytes
)

func UploadFile(c *gin.Context) {
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

	storage, err := getUserStorage(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not check storage usage"})
		return
	}

	err = c.Request.ParseMultipartForm(MaxFileSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large or invalid form data"})
		return
	}

	file, fileHeader, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	if fileHeader.Size > MaxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds 50MB limit"})
		return
	}

	if storage.UsedSpace+fileHeader.Size > MaxStorageSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         "Upload would exceed 2GB storage limit",
			"current_usage": storage.UsedSpace,
			"max_storage":   MaxStorageSize,
		})
		return
	}

	folderIDStr := c.PostForm("folder_id")
	var folderID *primitive.ObjectID
	if folderIDStr != "" {
		folderObjID, err := primitive.ObjectIDFromHex(folderIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
			return
		}

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

	fileID := primitive.NewObjectID()
	ext := filepath.Ext(fileHeader.Filename)
	gcsFileName := fmt.Sprintf("users/%s/files/%s%s", userIDString, fileID.Hex(), ext)

	file.Seek(0, 0)
	hash := md5.New()
	_, err = io.Copy(hash, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not calculate file hash"})
		return
	}
	fileHash := fmt.Sprintf("%x", hash.Sum(nil))

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

	file.Seek(0, 0)
	gcsURL, err := utils.UploadToGCS(c, gcsFileName, file, fileHeader.Header.Get("Content-Type"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Could not upload file to storage: %v", err)})
		return
	}

	fileRecord := models.File{
		ID:           fileID,
		Name:         fileHeader.Filename,
		OriginalName: fileHeader.Filename,
		Size:         fileHeader.Size,
		ContentType:  fileHeader.Header.Get("Content-Type"),
		UserID:       userID,
		FolderID:     folderID,
		Path:         gcsFileName,
		URL:          gcsURL,
		Hash:         fileHash,
		IsFavorite:   false,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	_, err = fileCollection.InsertOne(c, fileRecord)
	if err != nil {
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
		// For root folder, get files where folder_id is null or doesn't exist
		filter["$or"] = []bson.M{
			{"folder_id": bson.M{"$exists": false}},
			{"folder_id": nil},
		}
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

// DownloadFile handles file download using proxy method by default, with signed URL fallback
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

	// Check if signed URL is explicitly requested
	if c.Query("redirect") == "true" {
		// Try to generate signed URL for redirect
		signedURL, err := utils.GenerateSignedURL(c, file.Path, time.Hour)
		if err != nil {
			// If signed URL generation fails, fall back to proxy download
			c.JSON(http.StatusOK, gin.H{
				"download_url": fmt.Sprintf("/api/files/%s/download", fileID),
				"expires_in":   "session",
				"method":       "proxy",
				"note":         "Signed URL failed, use direct download",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"download_url": signedURL,
			"expires_in":   "1 hour",
			"method":       "signed_url",
		})
		return
	}

	// Default behavior: Direct proxy download through our server
	reader, err := utils.DownloadFromGCS(c, file.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not download file"})
		return
	}
	defer reader.Close()

	// Set appropriate headers for file download
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", file.OriginalName))
	c.Header("Content-Type", file.ContentType)
	c.Header("Content-Length", fmt.Sprintf("%d", file.Size))

	// Stream the file directly to the client
	_, err = io.Copy(c.Writer, reader)
	if err != nil {
		// Log error but don't send JSON response as headers are already sent
		fmt.Printf("Error streaming file: %v\n", err)
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
	userIDInterface, exists := c.Get("userID")
	if !exists {
		log.Printf("ERROR: userID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found"})
		return
	}

	userIDString := userIDInterface.(string)
	log.Printf("GetStorageInfo called for user: %s", userIDString)

	userID, err := primitive.ObjectIDFromHex(userIDString)
	if err != nil {
		log.Printf("ERROR: Invalid user ID format: %s", userIDString)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Recalculate storage from actual files and folders
	err = recalculateUserStorage(c, userID)
	if err != nil {
		log.Printf("Warning: Could not recalculate storage: %v", err)
	}

	storage, err := getUserStorage(c, userID)
	if err != nil {
		log.Printf("ERROR: Could not get storage for user %s: %v", userIDString, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve storage info"})
		return
	}

	log.Printf("Storage info for user %s: %+v", userIDString, storage)

	// Calculate usage percentage safely
	var usagePercentage float64 = 0
	if storage.MaxSpace > 0 {
		usagePercentage = float64(storage.UsedSpace) / float64(storage.MaxSpace) * 100
	}

	response := gin.H{
		"storage":          storage,
		"usage_percentage": usagePercentage,
	}

	log.Printf("Sending storage response: %+v", response)
	c.JSON(http.StatusOK, response)
}

// Helper function to get user storage information
func getUserStorage(c *gin.Context, userID primitive.ObjectID) (*models.UserStorage, error) {
	collection := utils.GetCollection("user_storage")
	var storage models.UserStorage

	log.Printf("Looking up storage for user: %s", userID.Hex())
	err := collection.FindOne(c, bson.M{"user_id": userID}).Decode(&storage)
	if err != nil {
		log.Printf("Storage record not found for user %s, creating new one: %v", userID.Hex(), err)
		// Create default storage record if it doesn't exist
		storage = models.UserStorage{
			UserID:      userID,
			UsedSpace:   0,
			MaxSpace:    MaxStorageSize,
			FileCount:   0,
			FolderCount: 0,
			UpdatedAt:   time.Now(),
		}

		result, insertErr := collection.InsertOne(c, storage)
		if insertErr != nil {
			log.Printf("Failed to create storage record for user %s: %v", userID.Hex(), insertErr)
			return nil, insertErr
		}
		log.Printf("Created new storage record for user %s: %v", userID.Hex(), result.InsertedID)
	} else {
		log.Printf("Found existing storage record for user %s: %+v", userID.Hex(), storage)
		log.Printf("Storage values - UsedSpace: %d, MaxSpace: %d", storage.UsedSpace, storage.MaxSpace)

		// Fix any storage records with invalid MaxSpace
		if storage.MaxSpace <= 0 {
			log.Printf("Fixing invalid MaxSpace for user %s", userID.Hex())
			storage.MaxSpace = MaxStorageSize
			collection.UpdateOne(c, bson.M{"user_id": userID}, bson.M{
				"$set": bson.M{"max_space": MaxStorageSize, "updated_at": time.Now()},
			})
		}
	}

	return &storage, nil
}

// recalculateUserStorage recalculates storage from actual files and folders
func recalculateUserStorage(c *gin.Context, userID primitive.ObjectID) error {
	// Calculate total file size
	fileCollection := utils.GetCollection("files")
	pipeline := []bson.M{
		{"$match": bson.M{"user_id": userID}},
		{"$group": bson.M{
			"_id":       nil,
			"totalSize": bson.M{"$sum": "$size"},
			"fileCount": bson.M{"$sum": 1},
		}},
	}

	cursor, err := fileCollection.Aggregate(c, pipeline)
	if err != nil {
		return fmt.Errorf("could not aggregate file sizes: %v", err)
	}
	defer cursor.Close(c)

	var result struct {
		TotalSize int64 `bson:"totalSize"`
		FileCount int   `bson:"fileCount"`
	}

	if cursor.Next(c) {
		if err := cursor.Decode(&result); err != nil {
			return fmt.Errorf("could not decode aggregation result: %v", err)
		}
	}

	// Count folders
	folderCollection := utils.GetCollection("folders")
	folderCount, err := folderCollection.CountDocuments(c, bson.M{"user_id": userID})
	if err != nil {
		return fmt.Errorf("could not count folders: %v", err)
	}

	// Update storage record
	storageCollection := utils.GetCollection("user_storage")
	_, err = storageCollection.UpdateOne(
		c,
		bson.M{"user_id": userID},
		bson.M{
			"$set": bson.M{
				"used_space":   result.TotalSize,
				"file_count":   result.FileCount,
				"folder_count": int(folderCount),
				"updated_at":   time.Now(),
			},
		},
		options.Update().SetUpsert(true),
	)

	if err != nil {
		return fmt.Errorf("could not update storage record: %v", err)
	}

	fmt.Printf("DEBUG: Recalculated storage for user %s - Size: %d bytes, Files: %d, Folders: %d\n",
		userID.Hex(), result.TotalSize, result.FileCount, int(folderCount))

	return nil
}

// ToggleFavorite toggles the favorite status of a file
func ToggleFavorite(c *gin.Context) {
	fileID := c.Param("id")
	fmt.Printf("ToggleFavorite called with fileID: %s\n", fileID)

	fileObjID, err := primitive.ObjectIDFromHex(fileID)
	if err != nil {
		fmt.Printf("Invalid file ID error: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	userIDInterface, exists := c.Get("userID")
	if !exists {
		fmt.Printf("User ID not found in context\n")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDString := userIDInterface.(string)
	userID, err := primitive.ObjectIDFromHex(userIDString)
	if err != nil {
		fmt.Printf("Invalid user ID error: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Find file record
	collection := utils.GetCollection("files")
	var file models.File
	err = collection.FindOne(c, bson.M{
		"_id":     fileObjID,
		"user_id": userID,
	}).Decode(&file)

	if err != nil {
		fmt.Printf("File not found error: %v\n", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	fmt.Printf("Current favorite status: %v\n", file.IsFavorite)

	// Toggle favorite status
	newFavoriteStatus := !file.IsFavorite
	updateResult, err := collection.UpdateOne(c, bson.M{
		"_id":     fileObjID,
		"user_id": userID,
	}, bson.M{
		"$set": bson.M{
			"is_favorite": newFavoriteStatus,
			"updated_at":  time.Now(),
		},
	})

	if err != nil {
		fmt.Printf("Update error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Could not update file: %v", err)})
		return
	}

	fmt.Printf("Update result - matched: %d, modified: %d\n", updateResult.MatchedCount, updateResult.ModifiedCount)

	c.JSON(http.StatusOK, gin.H{
		"message":     "File favorite status updated",
		"is_favorite": newFavoriteStatus,
	})
}

// GetFavoriteFiles retrieves all favorite files for the authenticated user
func GetFavoriteFiles(c *gin.Context) {
	userIDInterface, _ := c.Get("userID")
	userIDString := userIDInterface.(string)
	userID, _ := primitive.ObjectIDFromHex(userIDString)

	collection := utils.GetCollection("files")
	cursor, err := collection.Find(c, bson.M{
		"user_id":     userID,
		"is_favorite": true,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve favorite files"})
		return
	}
	defer cursor.Close(c)

	var files []models.File
	if err = cursor.All(c, &files); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not decode favorite files"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"files": files})
}
