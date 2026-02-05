package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// CreatePendingOrder handles POST /api/orders/create-pending
func CreatePendingOrder(c *fiber.Ctx) error {
	var input services.CreatePendingOrderInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	result, err := services.CreatePendingOrder(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// ConfirmPayment handles POST /api/orders/confirm-payment
func ConfirmPayment(c *fiber.Ctx) error {
	var input services.ConfirmPaymentInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	order, err := services.ConfirmPayment(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, order)
}

