package utils

import (
	"context"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client

func InitDB() error {
	uri := os.Getenv("MONGO_URI")

	if uri == "" {
		return Err("MONGO_URI not set")
	}

	clientOptions := options.Client().ApplyURI(uri).
		SetServerSelectionTimeout(30 * time.Second).
		SetConnectTimeout(10 * time.Second).
		SetSocketTimeout(10 * time.Second).
		SetMaxPoolSize(10).
		SetMinPoolSize(1).
		SetRetryWrites(true).
		SetRetryReads(true)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var err error
	Client, err = mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Printf("Failed to connect to MongoDB: %v", err)
		return err
	}

	err = Client.Ping(ctx, nil)
	if err != nil {
		log.Printf("Failed to ping MongoDB: %v", err)
		return err
	}

	log.Println("Successfully connected to MongoDB Atlas")
	return nil
}

func GetCollection(name string) *mongo.Collection {
	return Client.Database("driftbox").Collection(name)
}

func Err(msg string) error {
	log.Println(msg)
	return &customErr{msg}
}

type customErr struct {
	msg string
}

func (e *customErr) Error() string {
	return e.msg
}
