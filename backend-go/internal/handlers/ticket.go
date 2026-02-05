package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// GetTicket handles GET /api/ticket/:orderNumber
func GetTicket(c *fiber.Ctx) error {
	orderNumber := c.Params("orderNumber")
	token := c.Query("token")

	if orderNumber == "" || token == "" {
		return utils.BadRequest(c, "orderNumber and token are required")
	}

	ticket, err := services.GetTicketByToken(orderNumber, token)
	if err != nil {
		return utils.Unauthorized(c, err.Error())
	}

	return utils.SuccessResponse(c, ticket)
}

