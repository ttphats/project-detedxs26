package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ExpireOrders handles GET /api/cron/expire-orders
func ExpireOrders(c *fiber.Ctx) error {
	result, err := services.ExpireOrders()
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// CleanupLocks handles GET /api/cron/cleanup-locks
func CleanupLocks(c *fiber.Ctx) error {
	result, err := services.CleanupLocks()
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

