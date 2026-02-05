package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListTicketTypes handles GET /api/admin/ticket-types
func ListTicketTypes(c *fiber.Ctx) error {
	eventID := c.Query("eventId")

	result, err := admin.ListTicketTypes(eventID)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// CreateTicketType handles POST /api/admin/ticket-types
func CreateTicketType(c *fiber.Ctx) error {
	var input admin.CreateTicketTypeInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	ticketType, err := admin.CreateTicketType(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, ticketType)
}

type AssignSeatsRequest struct {
	TicketTypeID *string  `json:"ticketTypeId"`
	SeatIDs      []string `json:"seatIds"`
}

// AssignTicketTypeToSeats handles POST /api/admin/ticket-types/assign
func AssignTicketTypeToSeats(c *fiber.Ctx) error {
	var req AssignSeatsRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	count, err := admin.AssignTicketTypeToSeats(req.TicketTypeID, req.SeatIDs)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"affected": count,
	})
}

// DeleteTicketType handles DELETE /api/admin/ticket-types/:id
func DeleteTicketType(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.DeleteTicketType(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Ticket type deleted successfully")
}

