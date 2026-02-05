package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListSpeakers handles GET /api/admin/speakers
func ListSpeakers(c *fiber.Ctx) error {
	eventID := c.Query("eventId")

	result, err := admin.ListSpeakers(eventID)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

// CreateSpeaker handles POST /api/admin/speakers
func CreateSpeaker(c *fiber.Ctx) error {
	var input admin.CreateSpeakerInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	speaker, err := admin.CreateSpeaker(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, speaker)
}

// UpdateSpeaker handles PUT /api/admin/speakers/:id
func UpdateSpeaker(c *fiber.Ctx) error {
	id := c.Params("id")

	var input map[string]interface{}
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	speaker, err := admin.UpdateSpeaker(id, input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, speaker)
}

// DeleteSpeaker handles DELETE /api/admin/speakers/:id
func DeleteSpeaker(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.DeleteSpeaker(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Speaker deleted successfully")
}

