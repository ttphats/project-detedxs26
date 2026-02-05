package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/config"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// CronAuth validates cron secret from query parameter
func CronAuth(c *fiber.Ctx) error {
	secret := c.Query("secret")
	cfg := config.AppConfig

	if cfg.CronSecret != "" && secret != cfg.CronSecret {
		return utils.Unauthorized(c, "Invalid cron secret")
	}

	return c.Next()
}

