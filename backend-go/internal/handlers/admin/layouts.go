package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListLayouts handles GET /api/admin/layouts
func ListLayouts(c *fiber.Ctx) error {
	eventID := c.Query("eventId")

	result, err := admin.ListLayouts(eventID)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, result)
}

type CreateLayoutRequest struct {
	EventID string `json:"eventId"`
	Name    string `json:"name"`
}

// CreateLayout handles POST /api/admin/layouts
func CreateLayout(c *fiber.Ctx) error {
	var req CreateLayoutRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	layout, err := admin.CreateLayout(req.EventID, req.Name)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, layout)
}

// UpdateLayout handles PUT /api/admin/layouts/:id
func UpdateLayout(c *fiber.Ctx) error {
	id := c.Params("id")

	var input map[string]interface{}
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	err := admin.UpdateLayout(id, input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Layout updated successfully")
}

// DeleteLayout handles DELETE /api/admin/layouts/:id
func DeleteLayout(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.DeleteLayout(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Layout deleted successfully")
}

