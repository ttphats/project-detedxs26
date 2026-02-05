package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListUsers handles GET /api/admin/users
func ListUsers(c *fiber.Ctx) error {
	input := admin.ListUsersInput{
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
		Search: c.Query("search"),
		Role:   c.Query("role"),
		Status: c.Query("status"),
	}

	users, pagination, err := admin.ListUsers(input)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"users":      users,
		"pagination": pagination,
	})
}

// GetUser handles GET /api/admin/users/:id
func GetUser(c *fiber.Ctx) error {
	id := c.Params("id")

	user, err := admin.GetUserByID(id)
	if err != nil {
		return utils.NotFound(c, err.Error())
	}

	return utils.SuccessResponse(c, user)
}

// CreateUser handles POST /api/admin/users
func CreateUser(c *fiber.Ctx) error {
	var input admin.CreateUserInput
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	// Check role permission
	actorRole := c.Locals("role").(string)
	if !admin.CanManageRole(actorRole, input.Role) {
		return utils.Forbidden(c, "Cannot create user with this role")
	}

	user, err := admin.CreateUser(input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, user)
}

// UpdateUser handles PUT /api/admin/users/:id
func UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")

	var input map[string]interface{}
	if err := c.BodyParser(&input); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	// Check role permission if changing role
	if role, ok := input["role"].(string); ok {
		actorRole := c.Locals("role").(string)
		if !admin.CanManageRole(actorRole, role) {
			return utils.Forbidden(c, "Cannot assign this role")
		}
	}

	user, err := admin.UpdateUser(id, input)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessResponse(c, user)
}

// DeleteUser handles DELETE /api/admin/users/:id
func DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")

	// Prevent self-delete
	if c.Locals("userId").(string) == id {
		return utils.BadRequest(c, "Cannot delete yourself")
	}

	err := admin.DeleteUser(id)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "User deleted successfully")
}

