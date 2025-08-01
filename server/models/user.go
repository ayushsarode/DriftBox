package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username     string             `bson:"username" json:"username"`
	Email        string             `bson:"email" json:"email" binding:"required,email"`
	Password     string             `bson:"password,omitempty" json:"password,omitempty" binding:"required"`
	GoogleID     string             `bson:"google_id,omitempty" json:"google_id,omitempty"`
	Picture      string             `bson:"picture,omitempty" json:"picture,omitempty"`
	AuthProvider string             `bson:"auth_provider,omitempty" json:"auth_provider,omitempty"`
}
