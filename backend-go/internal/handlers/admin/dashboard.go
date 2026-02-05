package admin

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services/admin"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// GetDashboardStats handles GET /api/admin/dashboard/stats
func GetDashboardStats(c *fiber.Ctx) error {
	stats, err := admin.GetDashboardStats()
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, stats)
}

// GetRecentOrders handles GET /api/admin/dashboard/recent-orders
func GetRecentOrders(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 10)

	orders, err := admin.GetRecentOrders(limit)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"orders": orders,
	})
}

