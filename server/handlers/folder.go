package handlers

import (
	"net/http"
	"time"

	"github.com/ayushsarode/DriftBox/models"
	"github.com/ayushsarode/DriftBox/utils"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CreateFolder creates a new folder for the authenticated user
func CreateFolder(c *gin.Context) {
	var folderRequest struct {
		Name     string `json:"name" binding:"required"`
		ParentID string `json:"parent_id,omitempty"`
	}

	if err := c.ShouldBindJSON(&folderRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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

	folder := models.Folder{
		ID:        primitive.NewObjectID(),
		Name:      folderRequest.Name,
		UserID:    userID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// handling parent ID
	if folderRequest.ParentID != "" {
		parentID, err := primitive.ObjectIDFromHex(folderRequest.ParentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parent folder ID"})
			return
		}

		// Verify parent folder exists and belongs to user
		collection := utils.GetCollection("folders")
		var parentFolder models.Folder
		err = collection.FindOne(c, bson.M{
			"_id":     parentID,
			"user_id": userID,
		}).Decode(&parentFolder)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Parent folder not found"})
			return
		}

		folder.ParentID = &parentID
		folder.Path = parentFolder.Path + "/" + folderRequest.Name
	} else {
		folder.Path = "/" + folderRequest.Name
	}

	// Check if folder with same name exists in same location
	collection := utils.GetCollection("folders")
	var existingFolder models.Folder
	err = collection.FindOne(c, bson.M{
		"name":      folderRequest.Name,
		"user_id":   userID,
		"parent_id": folder.ParentID,
	}).Decode(&existingFolder)

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Folder with this name already exists"})
		return
	}

	// Create folder
	_, err = collection.InsertOne(c, folder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create folder"})
		return
	}

	// Update user storage stats
	updateUserStorage(c, userID, 0, 1, 0)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Folder created successfully",
		"folder":  folder,
	})
}

// GetFolders retrieves folders for the authenticated user
func GetFolders(c *gin.Context) {
	userIDInterface, _ := c.Get("userID")
	userIDString := userIDInterface.(string)
	userID, _ := primitive.ObjectIDFromHex(userIDString)

	parentID := c.Query("parent_id")
	filter := bson.M{"user_id": userID}

	if parentID != "" {
		parentObjID, err := primitive.ObjectIDFromHex(parentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parent folder ID"})
			return
		}
		filter["parent_id"] = parentObjID
	} else {
		filter["parent_id"] = bson.M{"$exists": false}
	}

	collection := utils.GetCollection("folders")
	cursor, err := collection.Find(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve folders"})
		return
	}
	defer cursor.Close(c)

	var folders []models.Folder
	if err = cursor.All(c, &folders); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not decode folders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"folders": folders})
}

// DeleteFolder deletes a folder and all its contents
func DeleteFolder(c *gin.Context) {
	folderID := c.Param("id")
	folderObjID, err := primitive.ObjectIDFromHex(folderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}

	userIDInterface, _ := c.Get("userID")
	userIDString := userIDInterface.(string)
	userID, _ := primitive.ObjectIDFromHex(userIDString)


	// get folders
	collection := utils.GetCollection("folders")

	// Verify folder exists and belongs to user
	var folder models.Folder
	err = collection.FindOne(c, bson.M{
		"_id":     folderObjID,
		"user_id": userID,
	}).Decode(&folder)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	// Delete folder
	_, err = collection.DeleteOne(c, bson.M{
		"_id":     folderObjID,
		"user_id": userID,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete folder"})
		return
	}

	// Update user storage stats
	updateUserStorage(c, userID, 0, -1, 0)

	c.JSON(http.StatusOK, gin.H{"message": "Folder deleted successfully"})
}

// Helper function to update user storage statistics
func updateUserStorage(c *gin.Context, userID primitive.ObjectID, sizeChange int64, folderChange int, fileChange int) {
	collection := utils.GetCollection("user_storage")

	// Try to find existing storage record
	var storage models.UserStorage
	err := collection.FindOne(c, bson.M{"user_id": userID}).Decode(&storage)

	if err != nil {
		// Create new storage record
		storage = models.UserStorage{
			UserID:      userID,
			UsedSpace:   sizeChange,
			MaxSpace:    2147483648, // 2GB in bytes
			FileCount:   fileChange,
			FolderCount: folderChange,
			UpdatedAt:   time.Now(),
		}
		collection.InsertOne(c, storage)
	} else {
		// Update existing record
		update := bson.M{
			"$inc": bson.M{
				"used_space":   sizeChange,
				"file_count":   fileChange,
				"folder_count": folderChange,
			},
			"$set": bson.M{
				"updated_at": time.Now(),
			},
		}
		collection.UpdateOne(c, bson.M{"user_id": userID}, update)
	}
}
