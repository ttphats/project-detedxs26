package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListSeats handles GET /api/admin/seats
func ListSeats(c *fiber.Ctx) error {
	input := admin.ListSeatsInput{
		EventID:      c.Query("eventId"),
		Status:       c.Query("status"),
		Section:      c.Query("section"),
		TicketTypeID: c.Query("ticketTypeId"),
		Page:         c.QueryInt("page", 1),
		Limit:        c.QueryInt("limit", 100),
	}

	seats, pagination, err := admin.ListSeats(input)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"seats":      seats,
		"pagination": pagination,
	})
}

// CreateSeat handles POST /api/admin/seats
func CreateSeat(c *fiber.Ctx) error {
	var input admin.CreateSeatInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	seat, err := admin.CreateSeat(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, seat)
}

type BulkCreateRequest struct {
	EventID string                 `json:"eventId"`
	Seats   []admin.CreateSeatInput `json:"seats"`
}

// BulkCreateSeats handles POST /api/admin/seats/bulk
func BulkCreateSeats(c *fiber.Ctx) error {
	var req BulkCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	count, err := admin.BulkCreateSeats(req.EventID, req.Seats)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"created": count,
	})
}

// UpdateSeat handles PUT /api/admin/seats/:id
func UpdateSeat(c *fiber.Ctx) error {
	id := c.Params("id")

	var input map[string]interface{}
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	seat, err := admin.UpdateSeat(id, input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, seat)
}

// DeleteSeat handles DELETE /api/admin/seats/:id
func DeleteSeat(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.DeleteSeat(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Seat deleted successfully")
}

