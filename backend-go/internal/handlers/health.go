package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// Health handles GET /api/health
func Health(c *fiber.Ctx) error {
	// Check database connection
	dbStatus := "connected"
	if err := db.DB.Ping(); err != nil {
		dbStatus = "disconnected"
	}

	return utils.SuccessResponse(c, fiber.Map{
		"status":   "ok",
		"database": dbStatus,
	})
}

