package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// AuthMiddleware validates JWT token and sets user in context
func AuthMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return utils.Unauthorized(c, "No token provided")
	}

	// Extract token from "Bearer <token>"
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return utils.Unauthorized(c, "Invalid token format")
	}

	tokenString := parts[1]

	claims, err := utils.VerifyToken(tokenString)
	if err != nil {
		return utils.Unauthorized(c, "Invalid or expired token")
	}

	// Set user info in context
	c.Locals("userId", claims.UserID)
	c.Locals("username", claims.Username)
	c.Locals("role", claims.Role)

	return c.Next()
}

// AdminMiddleware checks if user has admin or super_admin role
func AdminMiddleware(c *fiber.Ctx) error {
	role := c.Locals("role")
	if role == nil {
		return utils.Unauthorized(c, "Not authenticated")
	}

	roleStr := role.(string)
	if roleStr != "ADMIN" && roleStr != "SUPER_ADMIN" {
		return utils.Forbidden(c, "Admin access required")
	}

	return c.Next()
}

// SuperAdminMiddleware checks if user has super_admin role
func SuperAdminMiddleware(c *fiber.Ctx) error {
	role := c.Locals("role")
	if role == nil {
		return utils.Unauthorized(c, "Not authenticated")
	}

	if role.(string) != "SUPER_ADMIN" {
		return utils.Forbidden(c, "Super admin access required")
	}

	return c.Next()
}

// OptionalAuth tries to parse token but doesn't fail if not present
func OptionalAuth(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Next()
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return c.Next()
	}

	claims, err := utils.VerifyToken(parts[1])
	if err == nil {
		c.Locals("userId", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("role", claims.Role)
	}

	return c.Next()
}

