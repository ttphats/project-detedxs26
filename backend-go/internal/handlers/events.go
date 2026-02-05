package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListEvents handles GET /api/events
func ListEvents(c *fiber.Ctx) error {
	events, err := services.ListPublishedEvents()
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"events": events,
	})
}

// GetEvent handles GET /api/events/:id
func GetEvent(c *fiber.Ctx) error {
	id := c.Params("id")

	event, err := services.GetEventWithDetails(id)
	if err != nil {
		return utils.NotFound(c, err.Error())
	}

	return utils.SuccessResponse(c, event)
}

// GetEventBySlug handles GET /api/events/slug/:slug
func GetEventBySlug(c *fiber.Ctx) error {
	slug := c.Params("slug")

	event, err := services.GetEventBySlug(slug)
	if err != nil {
		return utils.NotFound(c, err.Error())
	}

	return utils.SuccessResponse(c, event)
}

// GetEventSeats handles GET /api/events/:id/seats
func GetEventSeats(c *fiber.Ctx) error {
	eventID := c.Params("id")
	sessionID := c.Query("sessionId", "")

	seats, err := services.GetEventSeats(eventID, sessionID)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"seats": seats,
	})
}

