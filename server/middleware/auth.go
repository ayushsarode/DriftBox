package middleware

import (
	"net/http"
	"strings"
	"github.com/golang-jwt/jwt/v5"
	"github.com/ayushsarode/DriftBox/utils"
	"github.com/gin-gonic/gin"
)

func Authmiddleware() gin.HandlerFunc {
	return func (c *gin.Context)  {
		tokenString := c.GetHeader("Authorization")

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorization"})
			c.Abort()
			return
		}

		parts:= strings.Split(tokenString, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return 
		}

		tokenString = parts[1]

		token, err := utils.ValidateToken(tokenString)

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		c.Set("userID", claims["userID"])

		c.Next()
	}
}