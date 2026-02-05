package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListEvents handles GET /api/admin/events
func ListEvents(c *fiber.Ctx) error {
	input := admin.ListEventsInput{
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
		Status: c.Query("status"),
		Search: c.Query("search"),
	}

	result, err := admin.ListEvents(input)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// GetEvent handles GET /api/admin/events/:id
func GetEvent(c *fiber.Ctx) error {
	id := c.Params("id")

	event, err := admin.GetEventByID(id)
	if err != nil {
		return utils.NotFound(c, err.Error())
	}

	return utils.SuccessResponse(c, event)
}

// CreateEvent handles POST /api/admin/events
func CreateEvent(c *fiber.Ctx) error {
	var input admin.CreateEventInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	event, err := admin.CreateEvent(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, event)
}

// UpdateEvent handles PUT /api/admin/events/:id
func UpdateEvent(c *fiber.Ctx) error {
	id := c.Params("id")

	var input map[string]interface{}
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	event, err := admin.UpdateEvent(id, input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, event)
}

// DeleteEvent handles DELETE /api/admin/events/:id
func DeleteEvent(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.DeleteEvent(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Event deleted successfully")
}

