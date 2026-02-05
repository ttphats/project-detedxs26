package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListEmailTemplates handles GET /api/admin/email-templates
func ListEmailTemplates(c *fiber.Ctx) error {
	purpose := c.Query("purpose")
	category := c.Query("category")

	templates, err := admin.ListEmailTemplates(purpose, category)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"templates": templates,
	})
}

// CreateEmailTemplate handles POST /api/admin/email-templates
func CreateEmailTemplate(c *fiber.Ctx) error {
	var input admin.CreateEmailTemplateInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	template, err := admin.CreateEmailTemplate(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, template)
}

// UpdateEmailTemplate handles PUT /api/admin/email-templates/:id
func UpdateEmailTemplate(c *fiber.Ctx) error {
	id := c.Params("id")

	var input map[string]interface{}
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	template, err := admin.UpdateEmailTemplate(id, input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, template)
}

// ActivateEmailTemplate handles POST /api/admin/email-templates/:id/activate
func ActivateEmailTemplate(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.ActivateEmailTemplate(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Template activated successfully")
}

// DeleteEmailTemplate handles DELETE /api/admin/email-templates/:id
func DeleteEmailTemplate(c *fiber.Ctx) error {
	id := c.Params("id")

	err := admin.DeleteEmailTemplate(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Template deleted successfully")
}

