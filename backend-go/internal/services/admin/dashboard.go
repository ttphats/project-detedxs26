package admin

import (
	"github.com/ttphats/tedx-backend/internal/db"
)

type DashboardStats struct {
	TotalEvents       int     `json:"totalEvents"`
	PublishedEvents   int     `json:"publishedEvents"`
	TotalSeats        int     `json:"totalSeats"`
	AvailableSeats    int     `json:"availableSeats"`
	ReservedSeats     int     `json:"reservedSeats"`
	SoldSeats         int     `json:"soldSeats"`
	TotalOrders       int     `json:"totalOrders"`
	PendingOrders     int     `json:"pendingOrders"`
	ConfirmedOrders   int     `json:"confirmedOrders"`
	PaidOrders        int     `json:"paidOrders"`
	TotalRevenue      float64 `json:"totalRevenue"`
	TodayOrders       int     `json:"todayOrders"`
	TodayRevenue      float64 `json:"todayRevenue"`
}

type RecentOrder struct {
	ID          string  `db:"id" json:"id"`
	OrderNumber string  `db:"order_number" json:"orderNumber"`
	EventName   string  `db:"event_name" json:"eventName"`
	CustomerName string `db:"customer_name" json:"customerName"`
	TotalAmount float64 `db:"total_amount" json:"totalAmount"`
	Status      string  `db:"status" json:"status"`
	CreatedAt   string  `db:"created_at" json:"createdAt"`
}

// GetDashboardStats returns dashboard statistics
func GetDashboardStats() (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Events
	db.DB.Get(&stats.TotalEvents, "SELECT COUNT(*) FROM events")
	db.DB.Get(&stats.PublishedEvents, "SELECT COUNT(*) FROM events WHERE is_published = 1")

	// Seats
	db.DB.Get(&stats.TotalSeats, "SELECT COUNT(*) FROM seats")
	db.DB.Get(&stats.AvailableSeats, "SELECT COUNT(*) FROM seats WHERE status = 'AVAILABLE'")
	db.DB.Get(&stats.ReservedSeats, "SELECT COUNT(*) FROM seats WHERE status = 'RESERVED'")
	db.DB.Get(&stats.SoldSeats, "SELECT COUNT(*) FROM seats WHERE status = 'SOLD'")

	// Orders
	db.DB.Get(&stats.TotalOrders, "SELECT COUNT(*) FROM orders")
	db.DB.Get(&stats.PendingOrders, "SELECT COUNT(*) FROM orders WHERE status = 'PENDING'")
	db.DB.Get(&stats.ConfirmedOrders, "SELECT COUNT(*) FROM orders WHERE status = 'PENDING_CONFIRMATION'")
	db.DB.Get(&stats.PaidOrders, "SELECT COUNT(*) FROM orders WHERE status = 'PAID'")

	// Revenue
	db.DB.Get(&stats.TotalRevenue, "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'PAID'")

	// Today
	db.DB.Get(&stats.TodayOrders, "SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURDATE()")
	db.DB.Get(&stats.TodayRevenue, "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'PAID' AND DATE(created_at) = CURDATE()")

	return stats, nil
}

// GetRecentOrders returns recent orders for dashboard
func GetRecentOrders(limit int) ([]RecentOrder, error) {
	if limit <= 0 {
		limit = 10
	}

	var orders []RecentOrder
	err := db.DB.Select(&orders, `
		SELECT o.id, o.order_number, e.name as event_name, o.customer_name, 
		       o.total_amount, o.status, o.created_at
		FROM orders o
		LEFT JOIN events e ON o.event_id = e.id
		ORDER BY o.created_at DESC
		LIMIT ?
	`, limit)

	return orders, err
}

