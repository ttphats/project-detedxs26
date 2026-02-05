package middleware

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ErrorHandler is custom error handler for Fiber
func ErrorHandler(c *fiber.Ctx, err error) error {
	// Default to 500
	code := fiber.StatusInternalServerError
	message := "Internal server error"

	// Check if it's a Fiber error
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message
	} else {
		// Log unexpected errors
		log.Printf("Unexpected error: %v", err)
	}

	return c.Status(code).JSON(utils.Response{
		Success: false,
		Error:   message,
	})
}

// RecoverMiddleware recovers from panics
func RecoverMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic recovered: %v", r)
				c.Status(fiber.StatusInternalServerError).JSON(utils.Response{
					Success: false,
					Error:   "Internal server error",
				})
			}
		}()
		return c.Next()
	}
}

