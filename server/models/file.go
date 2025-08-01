package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type File struct {
	ID           primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	Name         string              `bson:"name" json:"name" binding:"required"`
	OriginalName string              `bson:"original_name" json:"original_name"`
	Size         int64               `bson:"size" json:"size"` // Size in bytes
	ContentType  string              `bson:"content_type" json:"content_type"`
	UserID       primitive.ObjectID  `bson:"user_id" json:"user_id"`
	FolderID     *primitive.ObjectID `bson:"folder_id,omitempty" json:"folder_id,omitempty"`
	Path         string              `bson:"path" json:"path"` // File path on disk
	URL          string              `bson:"url" json:"url"`   // Download URL
	Hash         string              `bson:"hash" json:"hash"` // File hash for deduplication
	CreatedAt    time.Time           `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time           `bson:"updated_at" json:"updated_at"`
}

type UserStorage struct {
	UserID      primitive.ObjectID `bson:"user_id" json:"user_id"`
	UsedSpace   int64              `bson:"used_space" json:"used_space"` // Used space in bytes
	MaxSpace    int64              `bson:"max_space" json:"max_space"`   // Max space in bytes (2GB = 2147483648)
	FileCount   int                `bson:"file_count" json:"file_count"`
	FolderCount int                `bson:"folder_count" json:"folder_count"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}
