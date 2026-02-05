package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListAuditLogs handles GET /api/admin/audit-logs
func ListAuditLogs(c *fiber.Ctx) error {
	input := admin.ListAuditLogsInput{
		Page:       c.QueryInt("page", 1),
		Limit:      c.QueryInt("limit", 50),
		UserID:     c.Query("userId"),
		Action:     c.Query("action"),
		EntityType: c.Query("entityType"),
	}

	logs, pagination, err := admin.ListAuditLogs(input)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"logs":       logs,
		"pagination": pagination,
	})
}

