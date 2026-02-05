package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/ttphats/tedx-backend/internal/config"
	"strings"
)

// CORSMiddleware returns CORS middleware configured for the app
func CORSMiddleware() fiber.Handler {
	cfg := config.AppConfig
	origins := strings.Join(cfg.CORSOrigins, ",")

	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Requested-With",
		AllowCredentials: true,
		MaxAge:           86400,
	})
}

