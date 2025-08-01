package main

import (
	"log"
	"net/http"
	"os"

	"github.com/ayushsarode/DriftBox/handlers"
	"github.com/ayushsarode/DriftBox/middleware"
	"github.com/ayushsarode/DriftBox/utils"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()

	if err != nil {
		log.Println(".env file not found")
	}

	if err := utils.InitDB(); err != nil {
		log.Fatalf("failed to connect to MongoDB: %v", err)
	}
	log.Println("Connected to MongoDB")

	// init oauth google
	utils.InitGoogleAuth()
	log.Println("Google OAuth initialized")

	// init gcs
	if err := utils.InitGCS(); err != nil {
		log.Fatalf("failed to initialize Google Cloud Storage: %v", err)
	}
	log.Println("Google Cloud Storage initialized")

	httpPort := os.Getenv("PORT")
	if httpPort == "" {
		httpPort = "8000"
		log.Println("PORT not set, defaulting to 8000")
	}

	route := gin.Default()

	//cors
	route.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	route.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	route.POST("/register", handlers.Register)
	route.POST("/login", handlers.Login)

	// google auth
	route.GET("/auth/google", handlers.GoogleLogin)
	route.GET("/auth/google/callback", handlers.GoogleCallback)

	// (require authentication)
	protected := route.Group("/api")
	protected.Use(middleware.Authmiddleware())
	{
		// Folder management
		protected.POST("/folders", handlers.CreateFolder)
		protected.GET("/folders", handlers.GetFolders)
		protected.DELETE("/folders/:id", handlers.DeleteFolder)

		// File management
		protected.POST("/files/upload", handlers.UploadFile)
		protected.GET("/files", handlers.GetFiles)
		protected.GET("/files/:id/download", handlers.DownloadFile)
		protected.DELETE("/files/:id", handlers.DeleteFile)

		// Storage info
		protected.GET("/storage", handlers.GetStorageInfo)
	}

	log.Printf("Starting server on port %s", httpPort)
	if err := route.Run(":" + httpPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
