package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// Login handles POST /api/auth/login
func Login(c *fiber.Ctx) error {
	var input services.LoginInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	result, err := services.Login(input)
	if err != nil {
		return utils.Unauthorized(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// Register handles POST /api/auth/register
func Register(c *fiber.Ctx) error {
	var input services.RegisterInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	user, err := services.Register(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, user)
}

// Me handles GET /api/auth/me
func Me(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	user, err := services.GetCurrentUser(userID)
	if err != nil {
		return utils.NotFound(c, err.Error())
	}

	return utils.SuccessResponse(c, user)
}

