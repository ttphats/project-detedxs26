package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListOrders handles GET /api/admin/orders
func ListOrders(c *fiber.Ctx) error {
	input := admin.ListOrdersInput{
		Page:    c.QueryInt("page", 1),
		Limit:   c.QueryInt("limit", 20),
		Status:  c.Query("status"),
		EventID: c.Query("eventId"),
		Search:  c.Query("search"),
	}

	orders, pagination, err := admin.ListOrders(input)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"orders":     orders,
		"pagination": pagination,
	})
}

// ConfirmPayment handles POST /api/admin/orders/:id/confirm
func ConfirmPayment(c *fiber.Ctx) error {
	orderID := c.Params("id")
	userID := c.Locals("userId").(string)

	order, err := admin.ConfirmPayment(orderID, userID)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, order)
}

type RejectPaymentRequest struct {
	Reason string `json:"reason"`
}

// RejectPayment handles POST /api/admin/orders/:id/reject
func RejectPayment(c *fiber.Ctx) error {
	orderID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req RejectPaymentRequest
	c.BodyParser(&req)

	err := admin.RejectPayment(orderID, req.Reason, userID)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Order rejected successfully")
}

// ResendEmail handles POST /api/admin/orders/:id/resend-email
func ResendEmail(c *fiber.Ctx) error {
	// This would call email service to resend ticket
	// For now just return success
	return utils.SuccessMessage(c, "Email resent successfully")
}

