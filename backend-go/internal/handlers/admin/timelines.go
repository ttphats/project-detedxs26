package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListTimelines handles GET /api/admin/timelines
func ListTimelines(c *fiber.Ctx) error {
	eventID := c.Query("eventId")
	status := c.Query("status")

	timelines, err := admin.ListTimelines(eventID, status)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"timelines": timelines,
	})
}

// CreateTimeline handles POST /api/admin/timelines
func CreateTimeline(c *fiber.Ctx) error {
	var input admin.CreateTimelineInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	timeline, err := admin.CreateTimeline(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, timeline)
}

// UpdateTimeline handles PUT /api/admin/timelines/:id
func UpdateTimeline(c *fiber.Ctx) error {
	id := c.Params("id")

	var input map[string]interface{}
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	timeline, err := admin.UpdateTimeline(id, input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, timeline)
}

// DeleteTimeline handles DELETE /api/admin/timelines/:id
func DeleteTimeline(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.DeleteTimeline(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Timeline deleted successfully")
}

